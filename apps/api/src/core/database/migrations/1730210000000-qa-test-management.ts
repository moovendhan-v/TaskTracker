import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * E6.4 QA test management, per project (space):
 * - qa_suite: folders of test cases.
 * - qa_case: a test case with preconditions and steps (action + expected result), priority, type,
 *   status (draft, ready, deprecated), optionally covering a task (a feature or story).
 * - qa_plan: what to test for a sprint or a release: a set of cases, run and then approved.
 * - qa_plan_case: the cases in a plan, each optionally assigned to a tester.
 * - qa_run: every execution, append-only (the latest per plan and case is its current result):
 *   passed, failed, blocked or skipped, per-step results, and the bug filed for a failure.
 *
 * Tenant rows (RLS), plus a restrictive policy hiding rows of spaces the caller can't see (the same
 * rule tasks follow).
 */
export class QaTestManagement1730210000000 implements MigrationInterface {
  name = 'QaTestManagement1730210000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    const q = (sql: string) => queryRunner.query(sql);
    await q(`
      CREATE TABLE qa_suite (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        workspace_id uuid NOT NULL REFERENCES workspace(id) ON DELETE CASCADE,
        space_id uuid NOT NULL REFERENCES space(id) ON DELETE CASCADE,
        name varchar(120) NOT NULL,
        description varchar(2000) NOT NULL DEFAULT '',
        created_at timestamptz NOT NULL DEFAULT now(),
        UNIQUE (space_id, name)
      )`);
    await q(`
      CREATE TABLE qa_case (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        workspace_id uuid NOT NULL REFERENCES workspace(id) ON DELETE CASCADE,
        space_id uuid NOT NULL REFERENCES space(id) ON DELETE CASCADE,
        suite_id uuid REFERENCES qa_suite(id) ON DELETE SET NULL,
        number integer NOT NULL,
        title varchar(200) NOT NULL,
        preconditions varchar(5000) NOT NULL DEFAULT '',
        steps jsonb NOT NULL DEFAULT '[]' CHECK (jsonb_typeof(steps) = 'array' AND jsonb_array_length(steps) <= 50 AND pg_column_size(steps) <= 60000),
        priority varchar(10) NOT NULL DEFAULT 'medium' CHECK (priority IN ('critical', 'high', 'medium', 'low')),
        type varchar(20) NOT NULL DEFAULT 'functional' CHECK (type IN ('functional', 'regression', 'smoke', 'security', 'performance', 'usability', 'accessibility', 'other')),
        status varchar(12) NOT NULL DEFAULT 'ready' CHECK (status IN ('draft', 'ready', 'deprecated')),
        covers_task_id uuid REFERENCES task(id) ON DELETE SET NULL,
        created_by text REFERENCES "user"(id) ON DELETE SET NULL,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now(),
        UNIQUE (space_id, number)
      )`);
    await q(`CREATE INDEX qa_case_space_idx ON qa_case (workspace_id, space_id, suite_id)`);
    await q(`CREATE INDEX qa_case_covers_idx ON qa_case (covers_task_id) WHERE covers_task_id IS NOT NULL`);
    await q(`
      CREATE TABLE qa_plan (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        workspace_id uuid NOT NULL REFERENCES workspace(id) ON DELETE CASCADE,
        space_id uuid NOT NULL REFERENCES space(id) ON DELETE CASCADE,
        name varchar(120) NOT NULL,
        description varchar(2000) NOT NULL DEFAULT '',
        sprint_id uuid REFERENCES sprint(id) ON DELETE SET NULL,
        release varchar(60),
        status varchar(12) NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'approved', 'rejected')),
        decided_by text REFERENCES "user"(id) ON DELETE SET NULL,
        decided_at timestamptz,
        decision_note varchar(2000),
        created_by text REFERENCES "user"(id) ON DELETE SET NULL,
        created_at timestamptz NOT NULL DEFAULT now()
      )`);
    await q(`
      CREATE TABLE qa_plan_case (
        plan_id uuid NOT NULL REFERENCES qa_plan(id) ON DELETE CASCADE,
        case_id uuid NOT NULL REFERENCES qa_case(id) ON DELETE CASCADE,
        workspace_id uuid NOT NULL REFERENCES workspace(id) ON DELETE CASCADE,
        assignee_id text REFERENCES "user"(id) ON DELETE SET NULL,
        added_at timestamptz NOT NULL DEFAULT now(),
        PRIMARY KEY (plan_id, case_id)
      )`);
    await q(`
      CREATE TABLE qa_run (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        workspace_id uuid NOT NULL REFERENCES workspace(id) ON DELETE CASCADE,
        plan_id uuid NOT NULL REFERENCES qa_plan(id) ON DELETE CASCADE,
        case_id uuid NOT NULL REFERENCES qa_case(id) ON DELETE CASCADE,
        result varchar(10) NOT NULL CHECK (result IN ('passed', 'failed', 'blocked', 'skipped')),
        step_results jsonb NOT NULL DEFAULT '[]' CHECK (jsonb_typeof(step_results) = 'array' AND jsonb_array_length(step_results) <= 50),
        actual varchar(5000) NOT NULL DEFAULT '',
        environment varchar(20) CHECK (environment IS NULL OR environment IN ('development', 'uat', 'staging', 'production')),
        build varchar(60),
        bug_task_id uuid REFERENCES task(id) ON DELETE SET NULL,
        retest_of uuid REFERENCES qa_run(id) ON DELETE SET NULL,
        executed_by text REFERENCES "user"(id) ON DELETE SET NULL,
        executed_at timestamptz NOT NULL DEFAULT now()
      )`);
    await q(`CREATE INDEX qa_run_plan_case_idx ON qa_run (plan_id, case_id, executed_at DESC)`);
    await q(`CREATE INDEX qa_run_case_idx ON qa_run (case_id, executed_at DESC)`);

    for (const table of ['qa_suite', 'qa_case', 'qa_plan', 'qa_plan_case', 'qa_run']) {
      await q(`ALTER TABLE ${table} ENABLE ROW LEVEL SECURITY`);
      await q(`ALTER TABLE ${table} FORCE ROW LEVEL SECURITY`);
      await q(`CREATE POLICY tenant_isolation ON ${table} USING (app_can_access_workspace(workspace_id)) WITH CHECK (app_can_access_workspace(workspace_id))`);
    }
    // Spaces hidden from the caller (task.view denied there) hide their QA too.
    for (const table of ['qa_suite', 'qa_case', 'qa_plan']) {
      await q(`CREATE POLICY space_visible ON ${table} AS RESTRICTIVE USING (app_task_space_visible(space_id)) WITH CHECK (app_task_space_visible(space_id))`);
    }
    await q(`CREATE POLICY plan_visible ON qa_plan_case AS RESTRICTIVE USING (EXISTS (SELECT 1 FROM qa_plan p WHERE p.id = plan_id)) WITH CHECK (EXISTS (SELECT 1 FROM qa_plan p WHERE p.id = plan_id))`);
    await q(`CREATE POLICY plan_visible ON qa_run AS RESTRICTIVE USING (EXISTS (SELECT 1 FROM qa_plan p WHERE p.id = plan_id)) WITH CHECK (EXISTS (SELECT 1 FROM qa_plan p WHERE p.id = plan_id))`);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    for (const table of ['qa_run', 'qa_plan_case', 'qa_plan', 'qa_case', 'qa_suite']) await queryRunner.query(`DROP TABLE ${table}`);
  }
}
