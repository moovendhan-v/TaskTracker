import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * E5 AI: each workspace's AI switch and its pick of a configured provider and model, and each
 * person's AI use per workspace and day (for the daily token budget). Tenant rows only (RLS);
 * usage rows are read and written only for the signed-in person (the service checks).
 */
export class AiSettingsUsage1730160000000 implements MigrationInterface {
  name = 'AiSettingsUsage1730160000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    const q = (sql: string) => queryRunner.query(sql);
    await q(`
      CREATE TABLE workspace_ai_setting (
        workspace_id uuid PRIMARY KEY REFERENCES workspace(id) ON DELETE CASCADE,
        enabled boolean NOT NULL DEFAULT false,
        provider_id varchar(24),
        model varchar(120),
        updated_by_id text REFERENCES "user"(id) ON DELETE SET NULL,
        updated_at timestamptz NOT NULL DEFAULT now()
      )`);
    await q(`
      CREATE TABLE ai_usage (
        workspace_id uuid NOT NULL REFERENCES workspace(id) ON DELETE CASCADE,
        user_id text NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
        day date NOT NULL,
        requests integer NOT NULL DEFAULT 0 CHECK (requests >= 0),
        tokens integer NOT NULL DEFAULT 0 CHECK (tokens >= 0),
        PRIMARY KEY (workspace_id, user_id, day)
      )`);
    for (const table of ['workspace_ai_setting', 'ai_usage']) {
      await q(`ALTER TABLE ${table} ENABLE ROW LEVEL SECURITY`);
      await q(`ALTER TABLE ${table} FORCE ROW LEVEL SECURITY`);
      await q(`CREATE POLICY tenant_isolation ON ${table} USING (app_can_access_workspace(workspace_id)) WITH CHECK (app_can_access_workspace(workspace_id))`);
    }
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE ai_usage`);
    await queryRunner.query(`DROP TABLE workspace_ai_setting`);
  }
}
