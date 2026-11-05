import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * C4: a named dashboard can be shared with one department (a team) instead of
 * the whole workspace. People in it (their HR profile's department) and its head
 * can read it; writes stay the owner's. The department must be in the same
 * workspace (composite key); deleting it leaves the dashboard readable by its
 * owner only.
 */
export class DashboardTeams1729930000000 implements MigrationInterface {
  name = 'DashboardTeams1729930000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    const q = (sql: string) => queryRunner.query(sql);
    await q(`ALTER TABLE department ADD CONSTRAINT uq_department_workspace_id UNIQUE (workspace_id, id)`);
    await q(`ALTER TABLE dashboard ADD COLUMN department_id uuid`);
    await q(`
      ALTER TABLE dashboard ADD CONSTRAINT fk_dashboard_department FOREIGN KEY (workspace_id, department_id)
      REFERENCES department (workspace_id, id) ON DELETE SET NULL (department_id)`);
    await q(`CREATE INDEX idx_dashboard_department ON dashboard (department_id) WHERE department_id IS NOT NULL`);
    await q(`ALTER TABLE dashboard DROP CONSTRAINT chk_dashboard_visibility`);
    await q(`ALTER TABLE dashboard ADD CONSTRAINT chk_dashboard_visibility CHECK (visibility IN ('private', 'workspace', 'department'))`);
    // Only a team share names a department.
    await q(`ALTER TABLE dashboard ADD CONSTRAINT chk_dashboard_department CHECK (visibility = 'department' OR department_id IS NULL)`);
    await q(`
      CREATE OR REPLACE FUNCTION app_in_department(ws uuid, dept uuid) RETURNS boolean
      LANGUAGE sql STABLE AS $$
        SELECT dept IS NOT NULL AND (
          EXISTS (SELECT 1 FROM department d WHERE d.workspace_id = ws AND d.id = dept AND d.head_user_id = app_current_user_id())
          OR EXISTS (SELECT 1 FROM employee_profile p WHERE p.workspace_id = ws AND p.department_id = dept AND p.user_id = app_current_user_id())
        )
      $$`);
    await q(`DROP POLICY dashboard_read ON dashboard`);
    await q(`
      CREATE POLICY dashboard_read ON dashboard FOR SELECT
      USING (app_can_access_workspace(workspace_id) AND (
        app_is_platform_scope() OR owner_id = app_current_user_id() OR visibility = 'workspace'
        OR (visibility = 'department' AND app_in_department(workspace_id, department_id))
      ))`);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    const q = (sql: string) => queryRunner.query(sql);
    await q(`DROP POLICY dashboard_read ON dashboard`);
    await q(`
      CREATE POLICY dashboard_read ON dashboard FOR SELECT
      USING (app_can_access_workspace(workspace_id) AND (app_is_platform_scope() OR owner_id = app_current_user_id() OR visibility = 'workspace'))`);
    await q(`DROP FUNCTION IF EXISTS app_in_department(uuid, uuid)`);
    await q(`UPDATE dashboard SET visibility = 'private' WHERE visibility = 'department'`);
    await q(`ALTER TABLE dashboard DROP CONSTRAINT chk_dashboard_department`);
    await q(`ALTER TABLE dashboard DROP CONSTRAINT chk_dashboard_visibility`);
    await q(`ALTER TABLE dashboard ADD CONSTRAINT chk_dashboard_visibility CHECK (visibility IN ('private', 'workspace'))`);
    await q(`ALTER TABLE dashboard DROP COLUMN department_id`);
    await q(`ALTER TABLE department DROP CONSTRAINT uq_department_workspace_id`);
  }
}
