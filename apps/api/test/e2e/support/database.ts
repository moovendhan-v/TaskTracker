import pg from 'pg';
import { testDatabaseUrls } from './test-env.js';

/** A connection as the API's runtime role, for checks the API can't make, such as row-level security. */
export function runtimeDatabase(): pg.Pool {
  return new pg.Pool({ connectionString: testDatabaseUrls().runtime, max: 2 });
}

/** Runs queries in one transaction with the given row-level security settings, then rolls back. */
export async function withScope<T>(
  pool: pg.Pool,
  settings: { workspaceId?: string; userId?: string; platform?: boolean },
  work: (client: pg.PoolClient) => Promise<T>,
): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query(
      "SELECT set_config('app.workspace_id', $1, true), set_config('app.user_id', $2, true), set_config('app.scope', $3, true)",
      [settings.workspaceId ?? '', settings.userId ?? '', settings.platform ? 'platform' : ''],
    );
    return await work(client);
  } finally {
    await client.query('ROLLBACK');
    client.release();
  }
}
