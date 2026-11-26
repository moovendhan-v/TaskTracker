import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * E6.3 public bug intake and read-only bug links.
 *
 * bug_intake: one per project. A public key lets the embeddable feedback widget (on the sites in
 * `allowed_origins`) and the hosted feedback portal file reports into that project. The key is
 * public by design (it ships in a <script> tag); CAPTCHA, origin checks and rate limits guard it,
 * and an admin can rotate it.
 *
 * bug_share: read-only links to one report. `full` links are made by a member for someone outside
 * the workspace (details, screenshots, diagnostics); `status` links are what a portal or widget
 * reporter gets to follow their report. Only a SHA-256 hash of the link token is stored; links
 * expire and can be revoked.
 *
 * Tenant rows (RLS). Public lookups by key or token run in the platform scope inside the services.
 */
export class BugIntakeShares1730200000000 implements MigrationInterface {
  name = 'BugIntakeShares1730200000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    const q = (sql: string) => queryRunner.query(sql);
    await q(`
      CREATE TABLE bug_intake (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        workspace_id uuid NOT NULL REFERENCES workspace(id) ON DELETE CASCADE,
        space_id uuid NOT NULL UNIQUE REFERENCES space(id) ON DELETE CASCADE,
        public_key varchar(40) NOT NULL UNIQUE,
        title varchar(120) NOT NULL,
        intro varchar(1000) NOT NULL DEFAULT '',
        allowed_origins text[] NOT NULL DEFAULT '{}' CHECK (cardinality(allowed_origins) <= 20),
        widget_enabled boolean NOT NULL DEFAULT false,
        portal_enabled boolean NOT NULL DEFAULT false,
        created_by text NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now()
      )`);
    await q(`
      CREATE TABLE bug_share (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        workspace_id uuid NOT NULL REFERENCES workspace(id) ON DELETE CASCADE,
        task_id uuid NOT NULL REFERENCES task(id) ON DELETE CASCADE,
        token_hash char(64) NOT NULL UNIQUE,
        scope varchar(10) NOT NULL CHECK (scope IN ('full', 'status')),
        created_by text REFERENCES "user"(id) ON DELETE SET NULL,
        created_at timestamptz NOT NULL DEFAULT now(),
        expires_at timestamptz NOT NULL,
        revoked_at timestamptz,
        last_viewed_at timestamptz
      )`);
    await q(`CREATE INDEX bug_share_task_idx ON bug_share (workspace_id, task_id, created_at DESC)`);
    for (const table of ['bug_intake', 'bug_share']) {
      await q(`ALTER TABLE ${table} ENABLE ROW LEVEL SECURITY`);
      await q(`ALTER TABLE ${table} FORCE ROW LEVEL SECURITY`);
      await q(`CREATE POLICY tenant_isolation ON ${table} USING (app_can_access_workspace(workspace_id)) WITH CHECK (app_can_access_workspace(workspace_id))`);
    }
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE bug_share`);
    await queryRunner.query(`DROP TABLE bug_intake`);
  }
}
