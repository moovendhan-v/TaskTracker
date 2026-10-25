import { randomBytes } from 'node:crypto';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';

// Written by scripts/create-e2e-database.sh for local runs. Variables already set (as in CI) win.
const LOCAL_E2E_ENV = resolve(import.meta.dirname, '../../../../../.env.e2e');
if (existsSync(LOCAL_E2E_ENV)) process.loadEnvFile(LOCAL_E2E_ENV);

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
    // Optional: run the suite against a real Redis (CI does) instead of the in-process cache.
    ...(process.env['E2E_REDIS_URL'] ? { REDIS_URL: process.env['E2E_REDIS_URL'] } : {}),
  };
}
