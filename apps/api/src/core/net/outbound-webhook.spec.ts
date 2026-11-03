import { createHmac } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { deliverWebhook, isPublicAddress, parseAllowedHosts, signWebhook, webhookUrlProblem } from './outbound-webhook.js';

const policy = { allowedHosts: parseAllowedHosts(' hooks.example.com, *.acme.dev ') };

describe('outbound webhooks (SSRF rules)', () => {
  it('only calls https URLs on allowlisted host names', () => {
    expect(webhookUrlProblem('https://hooks.example.com/t/1', policy)).toBeNull();
    expect(webhookUrlProblem('https://ci.acme.dev/x', policy)).toBeNull();
    expect(webhookUrlProblem('https://acme.dev/x', policy)).toMatch(/allowlist/);
    expect(webhookUrlProblem('https://evil-acme.dev/x', policy)).toMatch(/allowlist/);
    expect(webhookUrlProblem('https://hooks.example.com.evil.io/', policy)).toMatch(/allowlist/);
    expect(webhookUrlProblem('http://hooks.example.com/', policy)).toMatch(/https/);
    expect(webhookUrlProblem('https://user:pw@hooks.example.com/', policy)).toMatch(/user name/);
    expect(webhookUrlProblem('https://hooks.example.com:8443/', policy)).toMatch(/standard https port/);
    expect(webhookUrlProblem('https://169.254.169.254/latest', { allowedHosts: ['169.254.169.254'] })).toMatch(/not an IP/);
    expect(webhookUrlProblem('https://[::1]/', { allowedHosts: ['::1'] })).toMatch(/not an IP/);
    expect(webhookUrlProblem('file:///etc/passwd', policy)).toMatch(/https/);
    expect(webhookUrlProblem('https://hooks.example.com/', { allowedHosts: [] })).toMatch(/turned off/);
  });

  it('treats private, loopback, link-local and metadata addresses as not public', () => {
    for (const address of ['127.0.0.1', '10.1.2.3', '172.20.0.1', '192.168.1.1', '169.254.169.254', '100.64.0.1', '0.0.0.0', '::1', 'fe80::1', 'fd00::1', '::ffff:127.0.0.1']) {
      expect(isPublicAddress(address), address).toBe(false);
    }
    expect(isPublicAddress('::ffff:7f00:1')).toBe(false);
    expect(isPublicAddress('93.184.216.34')).toBe(true);
    expect(isPublicAddress('::ffff:93.184.216.34')).toBe(true);
    expect(isPublicAddress('2606:4700::1111')).toBe(true);
    expect(isPublicAddress('not-an-ip')).toBe(false);
  });

  it('signs "<timestamp>.<body>" with the secret', () => {
    expect(signWebhook('s3cret', '1700000000', '{"a":1}')).toBe(`sha256=${createHmac('sha256', 's3cret').update('1700000000.{"a":1}').digest('hex')}`);
  });

  it('refuses a name that resolves to a private address, even when allowlisted', async () => {
    const result = await deliverWebhook({ url: 'https://localhost/hook', body: '{}', secret: 'x', deliveryId: 'd1', timeoutMs: 2_000 }, { allowedHosts: ['localhost'] }, new Date());
    expect(result).toMatchObject({ ok: false, status: null });
    expect(result.detail).toMatch(/private address/);
  });
});
