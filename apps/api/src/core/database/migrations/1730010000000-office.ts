import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * D3: the virtual office. Where each person stands on their workspace's floor, the state they
 * chose, and when they were last seen (the page sends a sign of life every minute). Nothing
 * is kept over time: one row per person per workspace.
 */
export class Office1730010000000 implements MigrationInterface {
  name = 'Office1730010000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    const q = (sql: string) => queryRunner.query(sql);
    await q(`
      CREATE TABLE office_presence (
        workspace_id uuid NOT NULL REFERENCES workspace(id) ON DELETE CASCADE,
        user_id text NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
        x smallint NOT NULL,
        y smallint NOT NULL,
        status text NOT NULL DEFAULT 'available',
        last_seen_at timestamptz NOT NULL DEFAULT now(),
        PRIMARY KEY (workspace_id, user_id),
        CONSTRAINT chk_office_presence_position CHECK (x BETWEEN 1 AND 22 AND y BETWEEN 1 AND 12),
        CONSTRAINT chk_office_presence_status CHECK (status IN ('available', 'focused', 'away'))
      )`);
    await q(`ALTER TABLE office_presence ENABLE ROW LEVEL SECURITY`);
    await q(`ALTER TABLE office_presence FORCE ROW LEVEL SECURITY`);
    await q(`CREATE POLICY office_presence_read ON office_presence FOR SELECT USING (app_can_access_workspace(workspace_id))`);
    // You place and change only yourself.
    await q(`
      CREATE POLICY office_presence_write ON office_presence FOR INSERT
      WITH CHECK (app_can_access_workspace(workspace_id) AND (app_is_platform_scope() OR user_id = app_current_user_id()))`);
    await q(`
      CREATE POLICY office_presence_update ON office_presence FOR UPDATE
      USING (app_can_access_workspace(workspace_id) AND (app_is_platform_scope() OR user_id = app_current_user_id()))
      WITH CHECK (app_can_access_workspace(workspace_id) AND (app_is_platform_scope() OR user_id = app_current_user_id()))`);
    await q(`
      CREATE POLICY office_presence_delete ON office_presence FOR DELETE
      USING (app_can_access_workspace(workspace_id) AND (app_is_platform_scope() OR user_id = app_current_user_id()))`);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS office_presence`);
  }
}
