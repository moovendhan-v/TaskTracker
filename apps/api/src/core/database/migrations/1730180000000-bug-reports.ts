import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * E6 visual bug reports. A report is a task of type "bug" plus `bug_report` (its QA details) and
 * `bug_capture` (redacted diagnostics: console, network, user actions). Both are reached only
 * through their task: tenant RLS plus a restrictive policy that the task is visible, so space
 * limits apply exactly as they do to the task. pg_trgm (a trusted extension) powers duplicate
 * detection on task titles.
 */
export class BugReports1730180000000 implements MigrationInterface {
  name = 'BugReports1730180000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    const q = (sql: string) => queryRunner.query(sql);
    await q(`CREATE EXTENSION IF NOT EXISTS pg_trgm`);
    await q(`CREATE INDEX IF NOT EXISTS idx_task_title_trgm ON task USING gin (title gin_trgm_ops)`);
    await q(`
      CREATE TABLE bug_report (
        task_id uuid PRIMARY KEY REFERENCES task(id) ON DELETE CASCADE,
        workspace_id uuid NOT NULL REFERENCES workspace(id) ON DELETE CASCADE,
        kind varchar(20) NOT NULL DEFAULT 'bug' CHECK (kind IN ('bug', 'suggestion', 'enhancement', 'feature_request')),
        severity varchar(2) NOT NULL DEFAULT 'P2' CHECK (severity IN ('P0', 'P1', 'P2', 'P3', 'P4')),
        environment varchar(12) NOT NULL DEFAULT 'production' CHECK (environment IN ('development', 'uat', 'staging', 'production')),
        module varchar(80),
        expected text NOT NULL DEFAULT '' CHECK (length(expected) <= 5000),
        actual text NOT NULL DEFAULT '' CHECK (length(actual) <= 5000),
        steps jsonb NOT NULL DEFAULT '[]'::jsonb CHECK (jsonb_typeof(steps) = 'array' AND jsonb_array_length(steps) <= 50),
        qa_state varchar(12) NOT NULL DEFAULT 'new' CHECK (qa_state IN ('new', 'confirmed', 'fixed', 'retest', 'verified', 'reopened', 'closed', 'duplicate', 'wont_fix')),
        source varchar(10) NOT NULL DEFAULT 'app' CHECK (source IN ('app', 'extension', 'sdk', 'portal', 'mcp', 'test_run')),
        page_url varchar(2000),
        browser varchar(120),
        os varchar(120),
        viewport varchar(20),
        user_agent varchar(500),
        reporter_id text REFERENCES "user"(id) ON DELETE SET NULL,
        reporter_name varchar(120),
        reporter_email varchar(254),
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now()
      )`);
    await q(`CREATE INDEX idx_bug_report_workspace ON bug_report (workspace_id, qa_state, severity)`);
    await q(`
      CREATE TABLE bug_capture (
        task_id uuid PRIMARY KEY REFERENCES bug_report(task_id) ON DELETE CASCADE,
        workspace_id uuid NOT NULL REFERENCES workspace(id) ON DELETE CASCADE,
        console jsonb NOT NULL DEFAULT '[]'::jsonb CHECK (jsonb_typeof(console) = 'array'),
        network jsonb NOT NULL DEFAULT '[]'::jsonb CHECK (jsonb_typeof(network) = 'array'),
        actions jsonb NOT NULL DEFAULT '[]'::jsonb CHECK (jsonb_typeof(actions) = 'array'),
        console_errors integer NOT NULL DEFAULT 0,
        failed_requests integer NOT NULL DEFAULT 0,
        created_at timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT chk_bug_capture_size CHECK (pg_column_size(console) + pg_column_size(network) + pg_column_size(actions) < 3000000)
      )`);
    for (const table of ['bug_report', 'bug_capture']) {
      await q(`ALTER TABLE ${table} ENABLE ROW LEVEL SECURITY`);
      await q(`ALTER TABLE ${table} FORCE ROW LEVEL SECURITY`);
      await q(`CREATE POLICY tenant_isolation ON ${table} USING (app_can_access_workspace(workspace_id)) WITH CHECK (app_can_access_workspace(workspace_id))`);
      // Visible only with its task (whose own RLS applies the caller's space limits).
      await q(`
        CREATE POLICY task_visible ON ${table} AS RESTRICTIVE
        USING (EXISTS (SELECT 1 FROM task WHERE task.id = ${table}.task_id))
        WITH CHECK (EXISTS (SELECT 1 FROM task WHERE task.id = ${table}.task_id))`);
    }
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE bug_capture`);
    await queryRunner.query(`DROP TABLE bug_report`);
    await queryRunner.query(`DROP INDEX IF EXISTS idx_task_title_trgm`);
  }
}
