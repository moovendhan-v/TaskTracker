import { tmpdir } from 'node:os';
import { randomBytes } from 'node:crypto';
import { existsSync } from 'node:fs';
import { join, resolve } from 'node:path';

// Written by scripts/create-e2e-database.sh for local runs. Variables already set (as in CI) win.
const LOCAL_E2E_ENV = resolve(import.meta.dirname, '../../../../../.env.e2e');
if (existsSync(LOCAL_E2E_ENV)) process.loadEnvFile(LOCAL_E2E_ENV);

/** LiveKit credentials the API under test uses, so tests can sign webhooks like LiveKit does. */
export const E2E_LIVEKIT_KEY = 'e2e-livekit';
export const E2E_LIVEKIT_SECRET = 'e2e-livekit-secret-0123456789abcdef';

/** The origin the API trusts for browser calls during the tests. */
export const TEST_ORIGIN = 'http://localhost:5173';

/**
 * Database URLs for the tests. They must point at a database whose name
 * contains "test", so a mistyped URL can't wipe real data.
 */
export function testDatabaseUrls(): { runtime: string; migration: string } {
  const runtime = process.env['E2E_DATABASE_URL'];
  if (!runtime) throw new Error('Set E2E_DATABASE_URL (and optionally E2E_MIGRATION_DATABASE_URL) to a dedicated test database.');
  const migration = process.env['E2E_MIGRATION_DATABASE_URL'] ?? runtime;
  for (const url of [runtime, migration]) {
    const database = new URL(url).pathname.slice(1);
    if (!database.includes('test')) throw new Error(`Refusing to run e2e tests against "${database}": the database name must contain "test".`);
  }
  return { runtime, migration };
}

/** Environment for the API process under test. */
export function apiProcessEnv(port: number): NodeJS.ProcessEnv {
  const { runtime, migration } = testDatabaseUrls();
  return {
    PATH: process.env['PATH'],
    NODE_ENV: 'test',
    PORT: String(port),
    DATABASE_URL: runtime,
    MIGRATION_DATABASE_URL: migration,
    DATABASE_SSL: 'false',
    BETTER_AUTH_SECRET: randomBytes(32).toString('base64'),
    BETTER_AUTH_URL: `http://localhost:${port}`,
    CORS_ORIGINS: TEST_ORIGIN,
    // Each test user sends its own X-Forwarded-For address, so per-IP auth limits apply per user.
    TRUST_PROXY: '1',
    // Check waits and due-soon / overdue triggers every second, so tests don't wait a minute.
    AUTOMATION_TICK_SECONDS: '1',
    CHAT_RETENTION_SWEEP_SECONDS: '1',
    // A placeholder GitHub OAuth app, so sign-in with GitHub is on; tests never reach GitHub itself.
    GITHUB_CLIENT_ID: 'e2e-github-client',
    GITHUB_CLIENT_SECRET: 'e2e-github-placeholder',
    // Calls (D2): tokens and webhooks are signed with these; no media server is needed for the API tests.
    LIVEKIT_URL: 'ws://127.0.0.1:7880',
    LIVEKIT_API_KEY: E2E_LIVEKIT_KEY,
    LIVEKIT_API_SECRET: E2E_LIVEKIT_SECRET,
    CALL_SWEEP_SECONDS: '0',
    // SSO (A4): the test identity provider in support/oidc-idp.ts.
    SSO_TRUSTED_ISSUERS: 'http://127.0.0.1:7790',
    // Webhook steps call a local receiver in tests; production refuses both settings below.
    AUTOMATION_WEBHOOK_HOSTS: 'localhost,127.0.0.1',
    AUTOMATION_WEBHOOK_INSECURE_FOR_TESTS: 'true',
    // Optional: run the suite against a real Redis (CI does) instead of the in-process cache.
    ...(process.env['E2E_REDIS_URL'] ? { REDIS_URL: process.env['E2E_REDIS_URL'] } : {}),
    // Uploads: a throwaway directory, or an S3-compatible service (MinIO, moto) when E2E_S3_ENDPOINT is set.
    ...(process.env['E2E_S3_ENDPOINT']
      ? {
          STORAGE_DRIVER: 's3',
          S3_ENDPOINT: process.env['E2E_S3_ENDPOINT'],
          S3_BUCKET: process.env['E2E_S3_BUCKET'] ?? 'taskflow-e2e',
          S3_ACCESS_KEY_ID: process.env['E2E_S3_ACCESS_KEY_ID'] ?? 'test',
          S3_SECRET_ACCESS_KEY: process.env['E2E_S3_SECRET_ACCESS_KEY'] ?? 'test',
          S3_FORCE_PATH_STYLE: 'true',
        }
      : { STORAGE_DRIVER: 'local', STORAGE_LOCAL_DIR: join(tmpdir(), `taskflow-e2e-uploads-${port}`) }),
  };
}
