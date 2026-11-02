import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * B4: workspace default layouts and personal version history.
 * - layout_default: one per workspace and page; anyone in the workspace reads it,
 *   changing it needs layout.manage (checked and audited in the service).
 * - dashboard_layout_version: a person's recent saves of a page, theirs alone.
 */
export class LayoutDefaultsAndVersions1729820000000 implements MigrationInterface {
  name = 'LayoutDefaultsAndVersions1729820000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    const q = (sql: string) => queryRunner.query(sql);
    await q(`
      CREATE TABLE layout_default (
        workspace_id uuid NOT NULL REFERENCES workspace(id) ON DELETE CASCADE,
        page_key text NOT NULL,
        items jsonb NOT NULL,
        updated_by text REFERENCES "user"(id) ON DELETE SET NULL,
        updated_at timestamptz NOT NULL DEFAULT now(),
        PRIMARY KEY (workspace_id, page_key),
        CONSTRAINT chk_layout_default_page CHECK (page_key ~ '^[a-z][a-z0-9:-]{0,59}$'),
        CONSTRAINT chk_layout_default_items CHECK (jsonb_typeof(items) = 'array' AND pg_column_size(items) < 65536)
      )`);
    await q(`ALTER TABLE layout_default ENABLE ROW LEVEL SECURITY`);
    await q(`ALTER TABLE layout_default FORCE ROW LEVEL SECURITY`);
    await q(`
      CREATE POLICY tenant_isolation ON layout_default
      USING (app_can_access_workspace(workspace_id)) WITH CHECK (app_can_access_workspace(workspace_id))`);

    await q(`
      CREATE TABLE dashboard_layout_version (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        workspace_id uuid NOT NULL REFERENCES workspace(id) ON DELETE CASCADE,
        user_id text NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
        page_key text NOT NULL,
        version integer NOT NULL,
        items jsonb NOT NULL,
        saved_at timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT chk_layout_version_items CHECK (jsonb_typeof(items) = 'array' AND pg_column_size(items) < 65536)
      )`);
    await q(`CREATE INDEX idx_layout_version_owner ON dashboard_layout_version (workspace_id, user_id, page_key, saved_at DESC)`);
    await q(`ALTER TABLE dashboard_layout_version ENABLE ROW LEVEL SECURITY`);
    await q(`ALTER TABLE dashboard_layout_version FORCE ROW LEVEL SECURITY`);
    await q(`
      CREATE POLICY own_versions ON dashboard_layout_version
      USING (app_can_access_workspace(workspace_id) AND (app_is_platform_scope() OR user_id = app_current_user_id()))
      WITH CHECK (app_can_access_workspace(workspace_id) AND user_id = app_current_user_id())`);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS dashboard_layout_version`);
    await queryRunner.query(`DROP TABLE IF EXISTS layout_default`);
  }
}
