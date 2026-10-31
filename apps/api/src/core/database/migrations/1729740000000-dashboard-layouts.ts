import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Personal dashboard layouts: one row per user, workspace and page. Row-level
 * security limits each row to its owner inside the current workspace.
 */
export class DashboardLayouts1729740000000 implements MigrationInterface {
  name = 'DashboardLayouts1729740000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    const q = (sql: string) => queryRunner.query(sql);
    await q(`
      CREATE TABLE dashboard_layout (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        workspace_id uuid NOT NULL REFERENCES workspace(id) ON DELETE CASCADE,
        user_id text NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
        page_key text NOT NULL,
        items jsonb NOT NULL DEFAULT '[]'::jsonb,
        version integer NOT NULL DEFAULT 1,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT uq_dashboard_layout UNIQUE (workspace_id, user_id, page_key),
        CONSTRAINT chk_dashboard_layout_page CHECK (page_key ~ '^[a-z][a-z0-9:-]{0,59}$'),
        CONSTRAINT chk_dashboard_layout_items CHECK (jsonb_typeof(items) = 'array'),
        CONSTRAINT chk_dashboard_layout_size CHECK (pg_column_size(items) < 65536),
        CONSTRAINT chk_dashboard_layout_version CHECK (version >= 1)
      )`);
    await q(`CREATE INDEX idx_dashboard_layout_user ON dashboard_layout (user_id)`);
    await q(`ALTER TABLE dashboard_layout ENABLE ROW LEVEL SECURITY`);
    await q(`ALTER TABLE dashboard_layout FORCE ROW LEVEL SECURITY`);
    await q(`
      CREATE POLICY own_layouts ON dashboard_layout
      USING (app_can_access_workspace(workspace_id) AND (app_is_platform_scope() OR user_id = app_current_user_id()))
      WITH CHECK (app_can_access_workspace(workspace_id) AND (app_is_platform_scope() OR user_id = app_current_user_id()))`);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS dashboard_layout`);
  }
}
