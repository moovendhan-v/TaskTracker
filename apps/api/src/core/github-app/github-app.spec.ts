import { createPublicKey, createVerify, generateKeyPairSync, type KeyObject } from 'node:crypto';
import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { loadEnv } from '../../config/env.schema.js';
import { checkGithubApp } from './check-github-app.js';
import { githubAppJwt, readGithubAppPrivateKey } from './github-app-credentials.js';

const { privateKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
const pem = privateKey.export({ type: 'pkcs1', format: 'pem' }).toString();
const base64Key = Buffer.from(pem).toString('base64');

const base = {
  DATABASE_URL: 'postgres://app:pw@localhost:5432/taskflow',
  BETTER_AUTH_SECRET: 'x'.repeat(32),
  BETTER_AUTH_URL: 'http://localhost:5180',
  CORS_ORIGINS: 'http://localhost:5180',
};
const app = { GITHUB_APP_ID: '1234567', GITHUB_APP_SLUG: 'taskflow-sync', GITHUB_APP_CLIENT_ID: 'Iv23liExample', GITHUB_APP_CLIENT_SECRET: 'client-secret', GITHUB_APP_PRIVATE_KEY: base64Key };

function decode(jwt: string, key: KeyObject): { header: unknown; payload: { iat: number; exp: number; iss: string }; valid: boolean } {
  const [header, payload, signature] = jwt.split('.');
  const valid = createVerify('RSA-SHA256').update(`${header}.${payload}`).verify(createPublicKey(key), Buffer.from(signature!, 'base64url'));
  return { header: JSON.parse(Buffer.from(header!, 'base64url').toString()), payload: JSON.parse(Buffer.from(payload!, 'base64url').toString()), valid };
}

describe('GitHub App private key', () => {
  it('reads the .pem base64-encoded on one line, or as PEM text with \\n escapes', () => {
    expect(readGithubAppPrivateKey(base64Key).asymmetricKeyType).toBe('rsa');
    expect(readGithubAppPrivateKey(pem.replace(/\n/g, '\\n')).asymmetricKeyType).toBe('rsa');
    expect(readGithubAppPrivateKey(pem).asymmetricKeyType).toBe('rsa');
  });

  it('refuses anything else', () => {
    expect(() => readGithubAppPrivateKey('not a key')).toThrow();
    const ec = generateKeyPairSync('ec', { namedCurve: 'P-256' }).privateKey.export({ type: 'pkcs8', format: 'pem' }).toString();
    expect(() => readGithubAppPrivateKey(ec)).toThrow(/RSA/);
  });

  it('signs a short-lived RS256 JWT issued by the App ID', () => {
    const now = Date.UTC(2026, 10, 12, 12);
    const { header, payload, valid } = decode(githubAppJwt('1234567', readGithubAppPrivateKey(base64Key), now), privateKey);
    expect(valid).toBe(true);
    expect(header).toEqual({ alg: 'RS256', typ: 'JWT' });
    expect(payload).toEqual({ iss: '1234567', iat: now / 1000 - 60, exp: now / 1000 + 540 });
  });
});

describe('GitHub App env settings', () => {
  it('is off when none are set, and on with all four (the client secret is optional)', () => {
    expect(loadEnv(base).GITHUB_APP_ID).toBeUndefined();
    expect(loadEnv({ ...base, ...app }).GITHUB_APP_SLUG).toBe('taskflow-sync');
  });

  it('refuses a partial or malformed setup', () => {
    expect(() => loadEnv({ ...base, ...app, GITHUB_APP_CLIENT_ID: '' })).toThrow(/Set all of GITHUB_APP_ID/);
    expect(loadEnv({ ...base, ...app, GITHUB_APP_CLIENT_SECRET: '' }).GITHUB_APP_ID).toBe('1234567');
    expect(() => loadEnv({ ...base, GITHUB_APP_CLIENT_SECRET: 'secret' })).toThrow(/needs the GitHub App settings/);
    expect(() => loadEnv({ ...base, ...app, GITHUB_APP_ID: 'abc' })).toThrow(/numeric App ID/);
    expect(() => loadEnv({ ...base, ...app, GITHUB_APP_PRIVATE_KEY: 'bm90IGEga2V5' })).toThrow(/private key GitHub generated/);
    expect(() => loadEnv({ ...base, GITHUB_APP_WEBHOOK_SECRET: 'w'.repeat(32) })).toThrow(/needs the GitHub App settings/);
    expect(() => loadEnv({ ...base, ...app, GITHUB_APP_WEBHOOK_SECRET: 'short' })).toThrow(/at least 16/);
  });
});

describe('github-app:check', () => {
  let server: Server;
  let apiUrl: string;
  let permissions: Record<string, string> = { issues: 'write', pull_requests: 'write', contents: 'read', metadata: 'read' };
  let seenJwt = '';

  beforeAll(async () => {
    // A stand-in for api.github.com that checks the app's JWT like GitHub does.
    server = createServer((request, response) => {
      const jwt = /^Bearer (.+)$/.exec(request.headers.authorization ?? '')?.[1] ?? '';
      seenJwt = jwt;
      const { payload, valid } = jwt.split('.').length === 3 ? decode(jwt, privateKey) : { payload: null, valid: false };
      if (!valid || payload?.iss !== '1234567') {
        response.writeHead(401).end('{}');
        return;
      }
      response.writeHead(200, { 'Content-Type': 'application/json' });
      if (request.url === '/app') response.end(JSON.stringify({ id: 1234567, slug: 'taskflow-sync', client_id: 'Iv23liExample', name: 'TaskFlow Sync', permissions }));
      else response.end(JSON.stringify([{ id: 1 }]));
    });
    await new Promise<void>((done) => server.listen(0, '127.0.0.1', done));
    apiUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  });

  afterAll(() => new Promise<void>((done) => server.close(() => done())));

  const run = async (overrides: Record<string, string> = {}) => {
    const lines: string[] = [];
    const ok = await checkGithubApp(loadEnv({ ...base, ...app, ...overrides }), { apiUrl, log: (line) => lines.push(line) });
    return { ok, output: lines.join('\n') };
  };

  it('passes with matching settings, and never prints a secret', async () => {
    const { ok, output } = await run();
    expect(ok).toBe(true);
    expect(output).toContain('✓ Signed in as the app “TaskFlow Sync”');
    expect(output).toContain('Installed on 1 account(s)');
    for (const secret of [app.GITHUB_APP_CLIENT_SECRET, base64Key, seenJwt]) expect(output).not.toContain(secret);
  });

  it('says what to fix', async () => {
    expect((await run({ GITHUB_APP_SLUG: 'other-app' })).output).toContain('GITHUB_APP_SLUG should be “taskflow-sync”');
    expect((await run({ GITHUB_APP_CLIENT_ID: 'Iv23liWrong' })).output).toContain('isn’t this app’s Client ID');
    expect((await run({ GITHUB_APP_ID: '999' })).output).toContain('GitHub refused the private key for this App ID');
    permissions = { issues: 'read', contents: 'read', metadata: 'read' };
    const { ok, output } = await run();
    expect(ok).toBe(false);
    expect(output).toContain('Permission issues should be Read and write');
    expect(output).toContain('Permission pull requests should be Read and write (it’s No access)');
  });

  it('explains when nothing is set up', async () => {
    const lines: string[] = [];
    expect(await checkGithubApp(loadEnv(base), { apiUrl, log: (line) => lines.push(line) })).toBe(false);
    expect(lines[0]).toMatch(/isn’t set up/);
  });
});
