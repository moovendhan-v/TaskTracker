import { tmpdir } from 'node:os';
import { randomBytes } from 'node:crypto';
import { existsSync } from 'node:fs';
import { join, resolve } from 'node:path';

// Written by scripts/create-e2e-database.sh for local runs. Variables already set (as in CI) win.
const LOCAL_E2E_ENV = resolve(import.meta.dirname, '../../../../.env.e2e');
if (existsSync(LOCAL_E2E_ENV)) process.loadEnvFile(LOCAL_E2E_ENV);

/** Ports for the stack Playwright starts: the built API and the Vite dev server in front of it. */
export const API_PORT = 3100;
export const WEB_PORT = 5174;
// localhost, not 127.0.0.1: passkeys (WebAuthn) need a domain name as the site id, never an IP.
export const WEB_URL = `http://localhost:${WEB_PORT}`;
export const API_DIR = resolve(import.meta.dirname, '../../../api');

function testDatabaseUrl(name: 'E2E_DATABASE_URL' | 'E2E_MIGRATION_DATABASE_URL'): string | undefined {
  const url = process.env[name];
  if (url && !new URL(url).pathname.includes('test')) {
    throw new Error(`Refusing to run browser tests against ${name}: the database name must contain "test".`);
  }
  return url;
}

/** Environment for the API under test, and for operator CLIs run against the same database. */
export function apiEnv(): NodeJS.ProcessEnv {
  const runtime = testDatabaseUrl('E2E_DATABASE_URL');
  if (!runtime) throw new Error('Set E2E_DATABASE_URL (and optionally E2E_MIGRATION_DATABASE_URL) to a dedicated test database.');
  return {
    PATH: process.env['PATH'],
    NODE_ENV: 'test',
    PORT: String(API_PORT),
    DATABASE_URL: runtime,
    MIGRATION_DATABASE_URL: testDatabaseUrl('E2E_MIGRATION_DATABASE_URL') ?? runtime,
    DATABASE_SSL: 'false',
    // Generated once per run and shared with the config through the environment, so CLIs match the server.
    BETTER_AUTH_SECRET: (process.env['E2E_AUTH_SECRET'] ??= randomBytes(32).toString('base64')),
    // The browser talks to the API through the Vite proxy, so the web origin is the API's origin too.
    BETTER_AUTH_URL: WEB_URL,
    CORS_ORIGINS: WEB_URL,
    TRUST_PROXY: '0',
    // A placeholder GitHub OAuth app, so "Continue with GitHub" shows; the tests stub github.com.
    GITHUB_CLIENT_ID: 'e2e-github-client',
    GITHUB_CLIENT_SECRET: 'e2e-github-placeholder',
    STORAGE_DRIVER: 'local',
    STORAGE_LOCAL_DIR: join(tmpdir(), 'taskflow-web-e2e-uploads'),
  };
}
