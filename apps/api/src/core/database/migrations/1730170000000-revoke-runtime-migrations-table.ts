import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Security audit (least privilege): the runtime role got read/write on TypeORM's `migrations`
 * table through the schema's default privileges. Only the migration owner needs it, so every
 * other role loses access (the runtime API never reads it). Runs as the owner, so the role
 * running migrations keeps its own access, also in single-role local setups.
 */
export class RevokeRuntimeMigrationsTable1730170000000 implements MigrationInterface {
  name = 'RevokeRuntimeMigrationsTable1730170000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DO $$
      DECLARE grantee_name text;
      BEGIN
        FOR grantee_name IN
          SELECT DISTINCT grantee FROM information_schema.role_table_grants
           WHERE table_schema = 'public' AND table_name = 'migrations' AND grantee NOT IN (current_user, 'PUBLIC')
        LOOP
          EXECUTE format('REVOKE ALL ON TABLE public.migrations FROM %I', grantee_name);
        END LOOP;
      END $$`);
  }

  async down(): Promise<void> {
    // Access isn't restored: nothing but the migration owner should touch this table.
  }
}
