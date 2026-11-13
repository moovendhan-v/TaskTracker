import { createPublicKey, createVerify, generateKeyPairSync } from 'node:crypto';
import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http';
import type { AddressInfo } from 'node:net';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { loadEnv } from '../../config/env.schema.js';
import { GithubApiError, GithubAppClient } from './github-app.client.js';

const { privateKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
const pem = privateKey.export({ type: 'pkcs1', format: 'pem' }).toString();

type Handler = (request: IncomingMessage, response: ServerResponse, body: string) => void;

describe('GithubAppClient', () => {
  let server: Server;
  let apiUrl: string;
  let handler: Handler;
  const seen: { method: string; url: string; auth: string }[] = [];
  let issued = 0;

  const appJwtValid = (auth: string) => {
    const jwt = auth.replace(/^Bearer /, '');
    const [header, payload, signature] = jwt.split('.');
    if (!signature) return false;
    const valid = createVerify('RSA-SHA256').update(`${header}.${payload}`).verify(createPublicKey(privateKey), Buffer.from(signature, 'base64url'));
    return valid && (JSON.parse(Buffer.from(payload!, 'base64url').toString()) as { iss: string }).iss === '42';
  };
  const json = (response: ServerResponse, status: number, value: unknown, headers: Record<string, string> = {}) => {
    response.writeHead(status, { 'Content-Type': 'application/json', ...headers });
    response.end(JSON.stringify(value));
  };
  /** Like GitHub: installation tokens for the app's JWT; repository calls need a live token. */
  const github: Handler = (request, response) => {
    const auth = request.headers.authorization ?? '';
    if (request.method === 'POST' && /^\/app\/installations\/\d+\/access_tokens$/.test(request.url!)) {
      if (!appJwtValid(auth)) return json(response, 401, {});
      issued += 1;
      return json(response, 201, { token: `ghs_token${issued}${'x'.repeat(30)}`, expires_at: new Date(Date.now() + 3_600_000).toISOString() });
    }
    if (!auth.startsWith('Bearer ghs_token')) return json(response, 401, {});
    return json(response, 200, { full_name: 'acme/app', token_used: auth.slice(7, 17) });
  };

  const client = (overrides: Record<string, string> = {}) =>
    new GithubAppClient(
      loadEnv({
        DATABASE_URL: 'postgres://a:b@localhost/x',
        BETTER_AUTH_SECRET: 'x'.repeat(32),
        BETTER_AUTH_URL: 'http://localhost:5180',
        CORS_ORIGINS: 'http://localhost:5180',
        GITHUB_APP_ID: '42',
        GITHUB_APP_SLUG: 'taskflow-test',
        GITHUB_APP_CLIENT_ID: 'Iv1test',
        GITHUB_APP_PRIVATE_KEY: pem,
        GITHUB_API_URL: apiUrl,
        ...overrides,
      }),
    );

  beforeAll(async () => {
    server = createServer((request, response) => {
      const chunks: Buffer[] = [];
      request.on('data', (chunk: Buffer) => chunks.push(chunk));
      request.on('end', () => {
        seen.push({ method: request.method!, url: request.url!, auth: request.headers.authorization ?? '' });
        handler(request, response, Buffer.concat(chunks).toString());
      });
    });
    await new Promise<void>((done) => server.listen(0, '127.0.0.1', done));
    apiUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  });
  afterAll(() => new Promise<void>((done) => server.close(() => done())));
  beforeEach(() => {
    handler = github;
    seen.length = 0;
    issued = 0;
  });

  it('is off without the app settings', () => {
    expect(client({ GITHUB_APP_ID: '', GITHUB_APP_SLUG: '', GITHUB_APP_CLIENT_ID: '', GITHUB_APP_PRIVATE_KEY: '' }).enabled).toBe(false);
    expect(client().enabled).toBe(true);
  });

  it('gets an installation token with the app JWT, and reuses it until it nearly expires', async () => {
    const app = client();
    const [first, second] = await Promise.all([app.asInstallation(7, 'GET', '/repos/acme/app'), app.asInstallation(7, 'GET', '/repos/acme/app')]);
    expect(first).toEqual({ full_name: 'acme/app', token_used: 'ghs_token1' });
    expect(second).toEqual(first);
    await app.asInstallation(7, 'GET', '/repos/acme/app');
    // One token for all three calls (the two at once shared the request).
    expect(issued).toBe(1);
    expect(seen.filter((call) => call.url.endsWith('/access_tokens'))).toHaveLength(1);
    // Another installation gets its own.
    await app.asInstallation(8, 'GET', '/repos/acme/other');
    expect(issued).toBe(2);
  });

  it('fetches a new token once when GitHub says the old one is no longer good', async () => {
    const app = client();
    await app.asInstallation(7, 'GET', '/repos/acme/app');
    let refuse = true;
    handler = (request, response, body) => {
      if (refuse && request.headers.authorization === `Bearer ghs_token1${'x'.repeat(30)}` && !request.url!.endsWith('/access_tokens')) {
        refuse = false;
        return json(response, 401, {});
      }
      github(request, response, body);
    };
    expect(await app.asInstallation(7, 'GET', '/repos/acme/app')).toEqual({ full_name: 'acme/app', token_used: 'ghs_token2' });
  });

  it('only calls GitHub’s API', async () => {
    const app = client();
    for (const path of ['//evil.example.com/x', 'https://evil.example.com/x', 'relative']) {
      await expect(app.asApp('GET', path)).rejects.toThrow(/Not a GitHub API path/);
    }
    await expect(app.asInstallation(0, 'GET', '/repos/acme/app')).rejects.toThrow(/Not a GitHub installation/);
    expect(seen).toHaveLength(0);
  });

  it('reports errors in its own words, with rate limits', async () => {
    const app = client();
    handler = (_request, response) => json(response, 403, { message: 'secret internal detail' }, { 'retry-after': '30' });
    const error = (await app.asApp('GET', '/app').catch((caught: unknown) => caught)) as GithubApiError;
    expect(error).toBeInstanceOf(GithubApiError);
    expect(error.message).toBe('GitHub answered 403');
    expect(error.rateLimited).toBe(true);
    expect(error.retryAfter).toBe(30);
  });

  it('refuses a malformed token, a huge answer, and non-JSON', async () => {
    const app = client();
    handler = (_request, response) => json(response, 201, { token: 'short', expires_at: 'soon' });
    await expect(app.asInstallation(9, 'GET', '/repos/acme/app')).rejects.toThrow(/unreadable installation token/);
    handler = (_request, response) => {
      response.writeHead(200, { 'Content-Type': 'application/json' });
      response.end(`"${'x'.repeat(6 * 1024 * 1024)}"`);
    };
    await expect(app.asApp('GET', '/app')).rejects.toThrow(/too large/);
    handler = (_request, response) => {
      response.writeHead(200, { 'Content-Type': 'text/html' });
      response.end('<html>');
    };
    await expect(app.asApp('GET', '/app')).rejects.toThrow(/isn’t JSON/);
  });

  it('sends JSON bodies and never follows redirects', async () => {
    const app = client();
    let received = '';
    handler = (request, response, body) => {
      if (request.url === '/moved') {
        response.writeHead(302, { Location: 'https://evil.example.com/' });
        return response.end();
      }
      received = body;
      json(response, 201, { ok: true });
    };
    expect(await app.asApp('POST', '/thing', { title: 'Hi' })).toEqual({ ok: true });
    expect(JSON.parse(received)).toEqual({ title: 'Hi' });
    await expect(app.asApp('GET', '/moved')).rejects.toThrow(GithubApiError);
  });
});
