import { createHmac } from 'node:crypto';
import { lookup as dnsLookup, type LookupAddress } from 'node:dns';
import http from 'node:http';
import https from 'node:https';
import { BlockList, isIP } from 'node:net';

/**
 * Server-side calls to URLs that users typed (the automation webhook action).
 * The SSRF rules from AGENTS.md, in one place:
 *
 * - https only, port 443, no credentials in the URL;
 * - the host must be on the server's allowlist (AUTOMATION_WEBHOOK_HOSTS),
 *   and IP literals are never allowed;
 * - every address the name resolves to must be public (no private, loopback,
 *   link-local, metadata, CGNAT, multicast or reserved ranges), and the
 *   connection goes to that checked address, so a second DNS answer can't
 *   swap it (rebinding);
 * - redirects are not followed, the whole call times out, and the response
 *   body is never read.
 */

const BLOCKED = new BlockList();
for (const [net, prefix] of [
  ['0.0.0.0', 8],
  ['10.0.0.0', 8],
  ['100.64.0.0', 10],
  ['127.0.0.0', 8],
  ['169.254.0.0', 16],
  ['172.16.0.0', 12],
  ['192.0.0.0', 24],
  ['192.0.2.0', 24],
  ['192.88.99.0', 24],
  ['192.168.0.0', 16],
  ['198.18.0.0', 15],
  ['198.51.100.0', 24],
  ['203.0.113.0', 24],
  ['224.0.0.0', 4],
  ['240.0.0.0', 4],
] as const) {
  BLOCKED.addSubnet(net, prefix, 'ipv4');
}
for (const [net, prefix] of [
  ['::', 128],
  ['::1', 128],
  ['64:ff9b::', 96],
  ['100::', 64],
  ['2001:db8::', 32],
  ['fc00::', 7],
  ['fe80::', 10],
  ['ff00::', 8],
] as const) {
  BLOCKED.addSubnet(net, prefix, 'ipv6');
}

/** True for addresses on the public internet only. */
export function isPublicAddress(address: string): boolean {
  const family = isIP(address);
  if (family === 0) return false;
  // IPv4-mapped IPv6 (::ffff:10.0.0.1) is judged by its IPv4 part. (A ::ffff:0:0/96 rule
  // can't be used: BlockList matches every IPv4 address against it.)
  const mapped = /^::ffff:(\d+\.\d+\.\d+\.\d+)$/i.exec(address)?.[1];
  if (mapped) return isPublicAddress(mapped);
  if (family === 6 && /^::ffff:/i.test(address)) return false;
  return !BLOCKED.check(address, family === 4 ? 'ipv4' : 'ipv6');
}

export interface WebhookPolicy {
  /** Exact hosts, or "*.example.com" for its subdomains. Empty turns webhooks off. */
  allowedHosts: readonly string[];
  /** Tests only (refused in production by the env schema): allow http and private addresses. */
  insecureForTests?: boolean;
}

export function parseAllowedHosts(value: string | undefined): string[] {
  return (value ?? '')
    .split(',')
    .map((host) => host.trim().toLowerCase())
    .filter(Boolean);
}

function hostAllowed(host: string, allowed: readonly string[]): boolean {
  return allowed.some((rule) => (rule.startsWith('*.') ? host.endsWith(rule.slice(1)) && host.length > rule.length - 1 : host === rule));
}

/** Why a URL can't be called, or null when it's fine to try (addresses are checked when connecting). */
export function webhookUrlProblem(raw: string, policy: WebhookPolicy): string | null {
  if (policy.allowedHosts.length === 0) return 'Webhooks are turned off on this server';
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return 'Enter a full URL, like https://hooks.example.com/…';
  }
  const insecure = policy.insecureForTests === true;
  if (url.protocol !== 'https:' && !(insecure && url.protocol === 'http:')) return 'Use an https:// URL';
  if (url.username || url.password) return 'URLs with a user name or password are not allowed';
  if (url.port && url.port !== '443' && !insecure) return 'Use the standard https port';
  const host = url.hostname.toLowerCase().replace(/^\[|\]$/g, '');
  if (isIP(host) && !insecure) return 'Use a host name, not an IP address';
  if (!hostAllowed(host, policy.allowedHosts)) return `${host} isn't on this server's webhook allowlist`;
  return null;
}

type LookupCallback = (error: NodeJS.ErrnoException | null, address: string | LookupAddress[], family?: number) => void;

/** A lookup that refuses names resolving to any non-public address, and pins the one it checked. */
function checkedLookup(insecure: boolean) {
  return (hostname: string, options: object, callback: LookupCallback) => {
    dnsLookup(hostname, { all: true }, (error, addresses) => {
      if (error) return callback(error, []);
      const list = addresses as LookupAddress[];
      const bad = list.find((entry) => !isPublicAddress(entry.address));
      if (!list.length || (bad && !insecure)) return callback(Object.assign(new Error('That host resolves to a private address'), { code: 'EBLOCKED' }), []);
      const first = list[0]!;
      // Node asks for either one address or all of them, depending on the agent.
      if ((options as { all?: boolean }).all) return callback(null, [first]);
      return callback(null, first.address, first.family);
    });
  };
}

export interface WebhookDelivery {
  url: string;
  body: string;
  secret: string;
  deliveryId: string;
  timeoutMs?: number;
}

export interface WebhookResult {
  ok: boolean;
  status: number | null;
  /** Short and ours, safe to show: "HTTP 500", "timed out", "blocked: private address". */
  detail: string;
}

/** The signature a receiver checks: HMAC-SHA256 of "<timestamp>.<body>" with the rule's secret. */
export function signWebhook(secret: string, timestamp: string, body: string): string {
  return `sha256=${createHmac('sha256', secret).update(`${timestamp}.${body}`).digest('hex')}`;
}

/** POSTs a signed JSON body. Never throws; never follows redirects; never reads the response. */
export function deliverWebhook(delivery: WebhookDelivery, policy: WebhookPolicy, now: Date): Promise<WebhookResult> {
  const problem = webhookUrlProblem(delivery.url, policy);
  if (problem) return Promise.resolve({ ok: false, status: null, detail: problem });
  const url = new URL(delivery.url);
  const timestamp = String(Math.floor(now.getTime() / 1000));
  const insecure = policy.insecureForTests === true;
  const client = url.protocol === 'http:' ? http : https;
  return new Promise((resolve) => {
    const request = client.request(
      url,
      {
        method: 'POST',
        lookup: checkedLookup(insecure) as never,
        timeout: delivery.timeoutMs ?? 5_000,
        headers: {
          'content-type': 'application/json',
          'user-agent': 'TaskFlow-Webhook/1',
          'x-taskflow-delivery': delivery.deliveryId,
          'x-taskflow-timestamp': timestamp,
          'x-taskflow-signature': signWebhook(delivery.secret, timestamp, delivery.body),
        },
      },
      (response) => {
        response.resume();
        const status = response.statusCode ?? 0;
        resolve({ ok: status >= 200 && status < 300, status, detail: status >= 300 && status < 400 ? `HTTP ${status} (redirects are not followed)` : `HTTP ${status}` });
      },
    );
    request.on('timeout', () => request.destroy(Object.assign(new Error('timed out'), { code: 'ETIMEDOUT' })));
    request.on('error', (error: NodeJS.ErrnoException) => {
      const detail = error.code === 'EBLOCKED' ? 'blocked: the host resolves to a private address' : error.code === 'ETIMEDOUT' ? 'timed out' : `could not connect (${error.code ?? 'error'})`;
      resolve({ ok: false, status: null, detail });
    });
    request.end(delivery.body);
  });
}
