import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * C4 dashboards on project pages: a named dashboard can belong to a project
 * (space_id), where it holds that project's blocks. Home dashboards keep a null
 * space_id. A project dashboard is visible only to people who can see the
 * project's tasks (restrictive policy, on top of the existing owner / shared /
 * team rules); deleting the project deletes its dashboards.
 */
export class ProjectDashboards1730120000000 implements MigrationInterface {
  name = 'ProjectDashboards1730120000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    const q = (sql: string) => queryRunner.query(sql);
    await q(`ALTER TABLE dashboard ADD COLUMN space_id uuid REFERENCES space(id) ON DELETE CASCADE`);
    await q(`CREATE INDEX idx_dashboard_space ON dashboard (workspace_id, space_id)`);
    await q(`
      CREATE POLICY space_access ON dashboard AS RESTRICTIVE
      USING (app_task_space_visible(space_id)) WITH CHECK (app_task_space_visible(space_id))`);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    const q = (sql: string) => queryRunner.query(sql);
    await q(`DROP POLICY space_access ON dashboard`);
    await q(`DROP INDEX idx_dashboard_space`);
    await q(`ALTER TABLE dashboard DROP COLUMN space_id`);
  }
}
