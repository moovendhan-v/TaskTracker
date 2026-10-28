import type { MigrationInterface, QueryRunner } from 'typeorm';

/** A workspace's own project templates: saved from a space or imported from a file. */
export class ProjectTemplates1729700000000 implements MigrationInterface {
  name = 'ProjectTemplates1729700000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    const q = (sql: string) => queryRunner.query(sql);
    await q(`
      CREATE TABLE project_template (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        workspace_id uuid NOT NULL REFERENCES workspace(id) ON DELETE CASCADE,
        name varchar(80) NOT NULL,
        description varchar(300) NOT NULL DEFAULT '',
        category varchar(20) NOT NULL DEFAULT 'general' CHECK (category IN ('engineering', 'marketing', 'operations', 'people', 'general')),
        content jsonb NOT NULL,
        created_by_id text REFERENCES "user"(id) ON DELETE SET NULL,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now()
      )`);
    await q(`CREATE INDEX idx_project_template_workspace ON project_template (workspace_id, created_at)`);
    await q(`ALTER TABLE project_template ENABLE ROW LEVEL SECURITY`);
    await q(`ALTER TABLE project_template FORCE ROW LEVEL SECURITY`);
    await q(`
      CREATE POLICY tenant_isolation ON project_template
      USING (app_can_access_workspace(workspace_id))
      WITH CHECK (app_can_access_workspace(workspace_id))`);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE project_template`);
  }
}
