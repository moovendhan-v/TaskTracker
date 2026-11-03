import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * E1 phase 2: time in automations.
 *
 * - `automation_job`: a run paused at a wait step, resumed by the scheduler at `run_at`.
 *   `flow_hash` is the flow it paused in; if the rule's flow changed since, the
 *   job is dropped instead of resuming somewhere that no longer exists.
 * - `automation_fire`: scheduled triggers (due soon, overdue) fire once per rule,
 *   task and key (the due date); the unique index makes a second fire a no-op,
 *   even with several API instances sweeping at once.
 *
 * Both are tenant tables with forced RLS, like automation_run.
 */
export class AutomationSchedules1729850000000 implements MigrationInterface {
  name = 'AutomationSchedules1729850000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    const q = (sql: string) => queryRunner.query(sql);
    await q(`ALTER TABLE automation_run DROP CONSTRAINT automation_run_status_check`);
    await q(`ALTER TABLE automation_run ADD CONSTRAINT automation_run_status_check CHECK (status IN ('succeeded', 'failed', 'skipped', 'waiting'))`);
    await q(`ALTER TABLE automation_run ADD COLUMN resumes_at timestamptz`);

    await q(`
      CREATE TABLE automation_job (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        workspace_id uuid NOT NULL REFERENCES workspace(id) ON DELETE CASCADE,
        rule_id uuid NOT NULL REFERENCES automation_rule(id) ON DELETE CASCADE,
        task_id uuid NOT NULL REFERENCES task(id) ON DELETE CASCADE,
        run_id uuid REFERENCES automation_run(id) ON DELETE SET NULL,
        step_id varchar(40) NOT NULL,
        flow_hash char(64) NOT NULL,
        context jsonb NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(context) = 'object' AND pg_column_size(context) < 2048),
        run_at timestamptz NOT NULL,
        created_at timestamptz NOT NULL DEFAULT now()
      )`);
    await q(`CREATE INDEX idx_automation_job_due ON automation_job (run_at)`);
    await q(`CREATE INDEX idx_automation_job_rule ON automation_job (workspace_id, rule_id)`);

    await q(`
      CREATE TABLE automation_fire (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        workspace_id uuid NOT NULL REFERENCES workspace(id) ON DELETE CASCADE,
        rule_id uuid NOT NULL REFERENCES automation_rule(id) ON DELETE CASCADE,
        task_id uuid NOT NULL REFERENCES task(id) ON DELETE CASCADE,
        fire_key varchar(40) NOT NULL,
        created_at timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT uq_automation_fire UNIQUE (rule_id, task_id, fire_key)
      )`);

    for (const table of ['automation_job', 'automation_fire']) {
      await q(`ALTER TABLE ${table} ENABLE ROW LEVEL SECURITY`);
      await q(`ALTER TABLE ${table} FORCE ROW LEVEL SECURITY`);
      await q(`
        CREATE POLICY tenant_isolation ON ${table}
        USING (app_can_access_workspace(workspace_id))
        WITH CHECK (app_can_access_workspace(workspace_id))`);
    }
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    const q = (sql: string) => queryRunner.query(sql);
    await q(`DROP TABLE automation_fire`);
    await q(`DROP TABLE automation_job`);
    await q(`ALTER TABLE automation_run DROP COLUMN resumes_at`);
    await q(`DELETE FROM automation_run WHERE status = 'waiting'`);
    await q(`ALTER TABLE automation_run DROP CONSTRAINT automation_run_status_check`);
    await q(`ALTER TABLE automation_run ADD CONSTRAINT automation_run_status_check CHECK (status IN ('succeeded', 'failed', 'skipped'))`);
  }
}
