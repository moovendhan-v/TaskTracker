import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * B5 doc templates: pages a workspace saves to start new pages from. The text is
 * sanitized like any page. Tenant rows only (RLS); everyone in the workspace who
 * can read docs sees them; whoever saved one, or a doc manager, can delete it
 * (the service checks).
 */
export class DocTemplates1730130000000 implements MigrationInterface {
  name = 'DocTemplates1730130000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    const q = (sql: string) => queryRunner.query(sql);
    await q(`
      CREATE TABLE doc_template (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        workspace_id uuid NOT NULL REFERENCES workspace(id) ON DELETE CASCADE,
        name varchar(60) NOT NULL,
        description varchar(200) NOT NULL DEFAULT '',
        icon varchar(40),
        content text NOT NULL,
        created_by_id text REFERENCES "user"(id) ON DELETE SET NULL,
        created_at timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT chk_doc_template_name CHECK (length(btrim(name)) BETWEEN 1 AND 60),
        CONSTRAINT chk_doc_template_content CHECK (length(content) <= 100000)
      )`);
    await q(`CREATE INDEX idx_doc_template_workspace ON doc_template (workspace_id, created_at)`);
    await q(`ALTER TABLE doc_template ENABLE ROW LEVEL SECURITY`);
    await q(`ALTER TABLE doc_template FORCE ROW LEVEL SECURITY`);
    await q(`
      CREATE POLICY tenant_isolation ON doc_template
      USING (app_can_access_workspace(workspace_id)) WITH CHECK (app_can_access_workspace(workspace_id))`);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE doc_template`);
  }
}
