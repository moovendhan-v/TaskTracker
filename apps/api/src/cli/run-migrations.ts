import 'reflect-metadata';
import { getMigrations } from 'better-auth/db/migration';
import { Pool } from 'pg';
import { DataSource } from 'typeorm';
import { createAuth } from '../core/auth/better-auth.factory.js';
import { ConsoleMailer } from '../core/auth/mailer/console.mailer.js';
import { loadEnv } from '../config/env.schema.js';
import { buildDataSourceOptions } from '../core/database/data-source-options.js';

/** Applies Better Auth's tables first, then TaskFlow's TypeORM migrations. */
async function main(): Promise<void> {
  const env = loadEnv();
  const pool = new Pool({ connectionString: env.DATABASE_URL, ssl: env.DATABASE_SSL ? { rejectUnauthorized: true } : false });
  try {
    const auth = createAuth(env, pool, new ConsoleMailer(false));
    const { runMigrations } = await getMigrations(auth.options);
    await runMigrations();
    console.log('Better Auth schema is up to date');
  } finally {
    await pool.end();
  }

  const dataSource = new DataSource(buildDataSourceOptions(env));
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
