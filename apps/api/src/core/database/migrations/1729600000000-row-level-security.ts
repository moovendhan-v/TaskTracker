import type { MigrationInterface, QueryRunner } from 'typeorm';

/** Tables whose rows belong to one workspace through a `workspace_id` column. */
const TENANT_TABLES = [
  'workspace_role',
  'workspace_member',
  'space',
  'task_list',
  'task',
  'task_comment',
  'sprint',
  'document',
  'department',
  'employee_profile',
  'leave_type',
  'leave_request',
  'leave_balance',
  // workspace_id is null for platform-level entries, which only the platform scope can read.
  'audit_log',
] as const;

/**
 * Row-level security on every TaskFlow table (AGENTS.md rule 1). The API sets
 * the scope per transaction (see core/database/data-scope.ts); policies read it
 * back through the functions below. FORCE applies the policies to the table
 * owner too, so a deployment that runs the API as the owner role is still covered.
 *
 * Better Auth's tables ("user", "session", "account", "verification") hold no
 * tenant data and are only reached by Better Auth and the users and admin
 * modules, so they are left out.
 */
export class RowLevelSecurity1729600000000 implements MigrationInterface {
  name = 'RowLevelSecurity1729600000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE FUNCTION app_current_workspace_id() RETURNS uuid LANGUAGE sql STABLE AS $$
        SELECT nullif(current_setting('app.workspace_id', true), '')::uuid
      $$`);
    await queryRunner.query(`
      CREATE FUNCTION app_current_user_id() RETURNS text LANGUAGE sql STABLE AS $$
        SELECT nullif(current_setting('app.user_id', true), '')
      $$`);
    await queryRunner.query(`
      CREATE FUNCTION app_is_platform_scope() RETURNS boolean LANGUAGE sql STABLE AS $$
        SELECT coalesce(current_setting('app.scope', true), '') = 'platform'
      $$`);
    await queryRunner.query(`
      CREATE FUNCTION app_can_access_workspace(target uuid) RETURNS boolean LANGUAGE sql STABLE AS $$
        SELECT app_is_platform_scope() OR target = app_current_workspace_id()
      $$`);

    for (const table of TENANT_TABLES) {
      await queryRunner.query(`ALTER TABLE ${table} ENABLE ROW LEVEL SECURITY`);
      await queryRunner.query(`ALTER TABLE ${table} FORCE ROW LEVEL SECURITY`);
      await queryRunner.query(`
        CREATE POLICY tenant_isolation ON ${table}
        USING (app_can_access_workspace(workspace_id))
        WITH CHECK (app_can_access_workspace(workspace_id))`);
    }

    await queryRunner.query(`ALTER TABLE workspace ENABLE ROW LEVEL SECURITY`);
    await queryRunner.query(`ALTER TABLE workspace FORCE ROW LEVEL SECURITY`);
    await queryRunner.query(`
      CREATE POLICY tenant_isolation ON workspace
      USING (app_can_access_workspace(id))
      WITH CHECK (app_can_access_workspace(id))`);

    // User scope (outside any workspace): read your own memberships, and the workspaces and roles they point to.
    await queryRunner.query(`
      CREATE POLICY own_membership_read ON workspace_member FOR SELECT
      USING (user_id = app_current_user_id())`);
    await queryRunner.query(`
      CREATE POLICY member_workspace_read ON workspace FOR SELECT
      USING (id IN (SELECT workspace_id FROM workspace_member WHERE user_id = app_current_user_id()))`);
    await queryRunner.query(`
      CREATE POLICY held_role_read ON workspace_role FOR SELECT
      USING (id IN (SELECT role_id FROM workspace_member WHERE user_id = app_current_user_id()))`);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP POLICY IF EXISTS held_role_read ON workspace_role`);
    await queryRunner.query(`DROP POLICY IF EXISTS member_workspace_read ON workspace`);
    await queryRunner.query(`DROP POLICY IF EXISTS own_membership_read ON workspace_member`);
    for (const table of ['workspace', ...TENANT_TABLES]) {
      await queryRunner.query(`DROP POLICY IF EXISTS tenant_isolation ON ${table}`);
      await queryRunner.query(`ALTER TABLE ${table} NO FORCE ROW LEVEL SECURITY`);
      await queryRunner.query(`ALTER TABLE ${table} DISABLE ROW LEVEL SECURITY`);
    }
    await queryRunner.query(`DROP FUNCTION IF EXISTS app_can_access_workspace(uuid)`);
    await queryRunner.query(`DROP FUNCTION IF EXISTS app_is_platform_scope()`);
    await queryRunner.query(`DROP FUNCTION IF EXISTS app_current_user_id()`);
    await queryRunner.query(`DROP FUNCTION IF EXISTS app_current_workspace_id()`);
  }
}
