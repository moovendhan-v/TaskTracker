import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * B4: a team's (HR department's) default for a page, between a person's own layout and the
 * workspace default. Anyone in the workspace reads it (people see their own team's); only
 * layout managers and the department's head write it (checked by the API, and audited).
 */
export class TeamLayouts1730040000000 implements MigrationInterface {
  name = 'TeamLayouts1730040000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    const q = (sql: string) => queryRunner.query(sql);
    await q(`
      CREATE TABLE layout_team_default (
        workspace_id uuid NOT NULL REFERENCES workspace(id) ON DELETE CASCADE,
        department_id uuid NOT NULL,
        page_key text NOT NULL,
        items jsonb NOT NULL,
        updated_by text REFERENCES "user"(id) ON DELETE SET NULL,
        updated_at timestamptz NOT NULL DEFAULT now(),
        PRIMARY KEY (workspace_id, department_id, page_key),
        CONSTRAINT fk_layout_team_department FOREIGN KEY (workspace_id, department_id) REFERENCES department (workspace_id, id) ON DELETE CASCADE,
        CONSTRAINT chk_layout_team_page CHECK (page_key ~ '^[a-z][a-z0-9:-]{0,59}$'),
        CONSTRAINT chk_layout_team_items CHECK (jsonb_typeof(items) = 'array' AND pg_column_size(items) < 65536)
      )`);
    await q(`ALTER TABLE layout_team_default ENABLE ROW LEVEL SECURITY`);
    await q(`ALTER TABLE layout_team_default FORCE ROW LEVEL SECURITY`);
    await q(`
      CREATE POLICY tenant_isolation ON layout_team_default
      USING (app_can_access_workspace(workspace_id)) WITH CHECK (app_can_access_workspace(workspace_id))`);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE layout_team_default`);
  }
}
