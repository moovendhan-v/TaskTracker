import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Named dashboards (Home tabs). Everyone in the workspace can read the ones
 * shared with the workspace; only the owner can read a private one, and only
 * the owner can create, change or delete theirs. Enforced by row-level security
 * per command, on top of the service's own checks.
 */
export class Dashboards1729760000000 implements MigrationInterface {
  name = 'Dashboards1729760000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    const q = (sql: string) => queryRunner.query(sql);
    await q(`
      CREATE TABLE dashboard (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        workspace_id uuid NOT NULL REFERENCES workspace(id) ON DELETE CASCADE,
        owner_id text NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
        name text NOT NULL,
        visibility text NOT NULL DEFAULT 'private',
        items jsonb NOT NULL DEFAULT '[]'::jsonb,
        version integer NOT NULL DEFAULT 1,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT chk_dashboard_name CHECK (length(btrim(name)) BETWEEN 1 AND 60),
        CONSTRAINT chk_dashboard_visibility CHECK (visibility IN ('private', 'workspace')),
        CONSTRAINT chk_dashboard_items CHECK (jsonb_typeof(items) = 'array' AND pg_column_size(items) < 65536),
        CONSTRAINT chk_dashboard_version CHECK (version >= 1)
      )`);
    await q(`CREATE INDEX idx_dashboard_workspace ON dashboard (workspace_id, visibility)`);
    await q(`CREATE INDEX idx_dashboard_owner ON dashboard (owner_id)`);
    await q(`ALTER TABLE dashboard ENABLE ROW LEVEL SECURITY`);
    await q(`ALTER TABLE dashboard FORCE ROW LEVEL SECURITY`);
    await q(`
      CREATE POLICY dashboard_read ON dashboard FOR SELECT
      USING (app_can_access_workspace(workspace_id) AND (app_is_platform_scope() OR owner_id = app_current_user_id() OR visibility = 'workspace'))`);
    await q(`
      CREATE POLICY dashboard_insert ON dashboard FOR INSERT
      WITH CHECK (app_can_access_workspace(workspace_id) AND owner_id = app_current_user_id())`);
    await q(`
      CREATE POLICY dashboard_update ON dashboard FOR UPDATE
      USING (app_can_access_workspace(workspace_id) AND (app_is_platform_scope() OR owner_id = app_current_user_id()))
      WITH CHECK (app_can_access_workspace(workspace_id) AND (app_is_platform_scope() OR owner_id = app_current_user_id()))`);
    await q(`
      CREATE POLICY dashboard_delete ON dashboard FOR DELETE
      USING (app_can_access_workspace(workspace_id) AND (app_is_platform_scope() OR owner_id = app_current_user_id()))`);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS dashboard`);
  }
}
