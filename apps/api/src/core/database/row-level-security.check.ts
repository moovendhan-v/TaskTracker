import { Inject, Injectable, Logger, type OnApplicationBootstrap } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import type { DataSource } from 'typeorm';
import { ENV } from '../../config/config.module.js';
import type { Env } from '../../config/env.schema.js';

/** Tables that hold one workspace's rows but don't have row-level security enabled and forced. */
const UNPROTECTED_TENANT_TABLES_SQL = `
  SELECT c.relname AS table_name
  FROM pg_class c
  JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE n.nspname = current_schema()
    AND c.relkind = 'r'
    AND (c.relname = 'workspace' OR EXISTS (
      SELECT 1 FROM pg_attribute a WHERE a.attrelid = c.oid AND a.attname = 'workspace_id' AND NOT a.attisdropped))
    AND NOT (c.relrowsecurity AND c.relforcerowsecurity)
  ORDER BY 1`;

/**
 * Refuses to start in production when row-level security could be bypassed:
 * a superuser or BYPASSRLS role ignores every policy, and a tenant table
 * without forced RLS has no policy to apply. Outside production it only warns,
 * so a fresh database can still be migrated and inspected.
 */
@Injectable()
export class RowLevelSecurityCheck implements OnApplicationBootstrap {
  private readonly logger = new Logger(RowLevelSecurityCheck.name);

  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    @Inject(ENV) private readonly env: Env,
  ) {}

  async onApplicationBootstrap(): Promise<void> {
    const problems = await this.findProblems();
    if (problems.length === 0) return;

    const message = `Row-level security is not effective: ${problems.join('; ')}`;
    if (this.env.NODE_ENV === 'production') throw new Error(message);
    this.logger.warn(message);
  }

  async findProblems(): Promise<string[]> {
    const problems: string[] = [];
    const [role] = await this.dataSource.query<{ rolsuper: boolean; rolbypassrls: boolean }[]>(
      'SELECT rolsuper, rolbypassrls FROM pg_roles WHERE rolname = current_user',
    );
    if (role?.rolsuper || role?.rolbypassrls) {
      problems.push('the API connects as a superuser or BYPASSRLS role; use a plain role for DATABASE_URL');
    }
    const tables = await this.dataSource.query<{ table_name: string }[]>(UNPROTECTED_TENANT_TABLES_SQL);
    if (tables.length > 0) {
      problems.push(`tables without forced RLS: ${tables.map((table) => table.table_name).join(', ')} (run migrations)`);
    }
    return problems;
  }
}
