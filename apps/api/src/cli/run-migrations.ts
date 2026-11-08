import 'reflect-metadata';
import { getMigrations } from 'better-auth/db/migration';
import { Pool } from 'pg';
import { DataSource } from 'typeorm';
import { createAuth } from '../core/auth/better-auth.factory.js';
import { ConsoleMailer } from '../core/auth/mailer/console.mailer.js';
import { loadEnv } from '../config/env.schema.js';
import { buildDataSourceOptions } from '../core/database/data-source-options.js';

/**
 * Applies Better Auth's tables first, then TaskFlow's TypeORM migrations. Runs
 * as the owner role (MIGRATION_DATABASE_URL) with the platform row-level
 * security scope, so data migrations can touch every workspace's rows.
 */
async function main(): Promise<void> {
  const env = loadEnv();
  const url = env.MIGRATION_DATABASE_URL ?? env.DATABASE_URL;
  const pool = new Pool({ connectionString: url, ssl: env.DATABASE_SSL ? { rejectUnauthorized: true } : false });
  try {
    const auth = createAuth(env, pool, new ConsoleMailer(false), { validateSchema: false });
    const { runMigrations } = await getMigrations(auth.options);
    await runMigrations();
    console.log('Better Auth schema is up to date');
  } finally {
    await pool.end();
  }

  const dataSource = new DataSource(buildDataSourceOptions(env, { url, platformScope: true }));
  await dataSource.initialize();
  try {
    const applied = await dataSource.runMigrations({ transaction: 'each' });
    console.log(`Applied ${applied.length} TaskFlow migration(s)`);
  } finally {
    await dataSource.destroy();
  }
}

main().catch((error: unknown) => {
  console.error('Migration failed', error);
  process.exit(1);
});
