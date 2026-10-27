import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Automation rules (per space) and a short log of their runs. Rules follow the
 * space's visibility like everything else in it (see the space-access migration).
 */
export class Automations1729710000000 implements MigrationInterface {
  name = 'Automations1729710000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    const q = (sql: string) => queryRunner.query(sql);
    await q(`
      CREATE TABLE automation_rule (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        workspace_id uuid NOT NULL REFERENCES workspace(id) ON DELETE CASCADE,
        space_id uuid NOT NULL REFERENCES space(id) ON DELETE CASCADE,
        name varchar(80) NOT NULL,
        enabled boolean NOT NULL DEFAULT true,
        trigger_type varchar(40) NOT NULL,
        trigger jsonb NOT NULL,
        conditions jsonb NOT NULL DEFAULT '{}'::jsonb,
        actions jsonb NOT NULL,
        created_by_id text REFERENCES "user"(id) ON DELETE SET NULL,
        run_count integer NOT NULL DEFAULT 0,
        last_run_at timestamptz,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now()
      )`);
    await q(`CREATE INDEX idx_automation_rule_trigger ON automation_rule (workspace_id, trigger_type) WHERE enabled`);
    await q(`CREATE INDEX idx_automation_rule_space ON automation_rule (workspace_id, space_id)`);

    await q(`
      CREATE TABLE automation_run (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        workspace_id uuid NOT NULL REFERENCES workspace(id) ON DELETE CASCADE,
        rule_id uuid NOT NULL REFERENCES automation_rule(id) ON DELETE CASCADE,
        task_id uuid REFERENCES task(id) ON DELETE SET NULL,
        status varchar(10) NOT NULL CHECK (status IN ('succeeded', 'failed', 'skipped')),
        message varchar(300) NOT NULL DEFAULT '',
        created_at timestamptz NOT NULL DEFAULT now()
      )`);
    await q(`CREATE INDEX idx_automation_run_rule ON automation_run (rule_id, created_at DESC)`);

    for (const table of ['automation_rule', 'automation_run']) {
      await q(`ALTER TABLE ${table} ENABLE ROW LEVEL SECURITY`);
      await q(`ALTER TABLE ${table} FORCE ROW LEVEL SECURITY`);
      await q(`
        CREATE POLICY tenant_isolation ON ${table}
        USING (app_can_access_workspace(workspace_id))
        WITH CHECK (app_can_access_workspace(workspace_id))`);
    }
    await q(`
      CREATE POLICY space_access ON automation_rule AS RESTRICTIVE
      USING (app_task_space_visible(space_id)) WITH CHECK (app_task_space_visible(space_id))`);

    await q(`ALTER TABLE notification DROP CONSTRAINT notification_kind_check`);
    await q(`
      ALTER TABLE notification ADD CONSTRAINT notification_kind_check
      CHECK (kind IN ('task_assigned', 'task_commented', 'leave_requested', 'leave_decided', 'member_added', 'automation'))`);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    const q = (sql: string) => queryRunner.query(sql);
    await q(`DELETE FROM notification WHERE kind = 'automation'`);
    await q(`ALTER TABLE notification DROP CONSTRAINT notification_kind_check`);
    await q(`
      ALTER TABLE notification ADD CONSTRAINT notification_kind_check
      CHECK (kind IN ('task_assigned', 'task_commented', 'leave_requested', 'leave_decided', 'member_added'))`);
    await q(`DROP TABLE automation_run`);
    await q(`DROP TABLE automation_rule`);
  }
}
