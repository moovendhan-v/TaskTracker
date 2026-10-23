import 'reflect-metadata';
import { DataSource } from 'typeorm';
import { loadEnv } from '../config/env.schema.js';
import { buildDataSourceOptions } from '../core/database/data-source-options.js';
import { APPLY_SCOPE_SQL, toScopeSettings } from '../core/database/data-scope.js';

const CLI_ACTOR = 'system:cli';

/**
 * Operator-only: grants SUPER_ADMIN to an existing account. Needs database
 * credentials, so it can't be reached from the web. Usage:
 *   pnpm --filter @taskflow/api admin:promote person@example.com
 */
async function main(): Promise<void> {
  const email = process.argv[2]?.trim();
  if (!email || !/^[^\s@]+@[^\s@]+$/.test(email) || email.length > 254) {
    console.error('Usage: admin:promote <email>');
    process.exit(2);
  }

  const dataSource = new DataSource(buildDataSourceOptions(loadEnv()));
  await dataSource.initialize();
  try {
    await dataSource.transaction(async (manager) => {
      // Platform-level audit entries have no workspace, so only the platform scope may write them.
      await manager.query(APPLY_SCOPE_SQL, toScopeSettings({ kind: 'platform' }));
      const rows: { id: string; platformRole: string }[] = await manager.query(
        `SELECT id, "platformRole" FROM "user" WHERE LOWER(email) = LOWER($1) FOR UPDATE`,
        [email],
      );
      const user = rows[0];
      if (!user) throw new Error('No account with that email. Ask the person to sign up first.');
      if (user.platformRole === 'SUPER_ADMIN') {
        console.log('That account is already a super admin.');
        return;
      }
      await manager.query(`UPDATE "user" SET "platformRole" = 'SUPER_ADMIN', "updatedAt" = now() WHERE id = $1`, [user.id]);
      await manager.query(
        `INSERT INTO audit_log (actor_id, action, target_type, target_id, metadata) VALUES ($1, 'admin.user.promote', 'user', $2, $3)`,
        [CLI_ACTOR, user.id, JSON.stringify({ via: 'cli' })],
      );
      console.log('Granted SUPER_ADMIN. The change applies on the next request.');
    });
  } finally {
    await dataSource.destroy();
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : 'Failed');
  process.exit(1);
});
