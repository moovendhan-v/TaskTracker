import type { MigrationInterface, QueryRunner } from 'typeorm';

/** B4: a named dashboard's recent saves, so its owner can go back to one. Its owner's alone. */
export class DashboardVersions1730050000000 implements MigrationInterface {
  name = 'DashboardVersions1730050000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    const q = (sql: string) => queryRunner.query(sql);
    await q(`
      CREATE TABLE dashboard_version (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        workspace_id uuid NOT NULL REFERENCES workspace(id) ON DELETE CASCADE,
        dashboard_id uuid NOT NULL REFERENCES dashboard(id) ON DELETE CASCADE,
        version integer NOT NULL,
        items jsonb NOT NULL,
        saved_at timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT chk_dashboard_version_items CHECK (jsonb_typeof(items) = 'array' AND pg_column_size(items) < 65536)
      )`);
    await q(`CREATE INDEX idx_dashboard_version ON dashboard_version (dashboard_id, saved_at DESC)`);
    await q(`ALTER TABLE dashboard_version ENABLE ROW LEVEL SECURITY`);
    await q(`ALTER TABLE dashboard_version FORCE ROW LEVEL SECURITY`);
    await q(`
      CREATE POLICY tenant_isolation ON dashboard_version
      USING (app_can_access_workspace(workspace_id)) WITH CHECK (app_can_access_workspace(workspace_id))`);
    // Only the dashboard's owner sees or writes its history (people it's shared with see the dashboard, not its past).
    await q(`
      CREATE POLICY owner_only ON dashboard_version AS RESTRICTIVE
      USING (EXISTS (SELECT 1 FROM dashboard d WHERE d.id = dashboard_version.dashboard_id AND d.workspace_id = dashboard_version.workspace_id AND d.owner_id = app_current_user_id()))
      WITH CHECK (EXISTS (SELECT 1 FROM dashboard d WHERE d.id = dashboard_version.dashboard_id AND d.workspace_id = dashboard_version.workspace_id AND d.owner_id = app_current_user_id()))`);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE dashboard_version`);
  }
}
