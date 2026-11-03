import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * E1 phase 3: webhook steps.
 *
 * - `automation_rule.webhook_secret_sealed`: the rule's signing secret, sealed
 *   with the server key (SecretBox); never returned except by an audited reveal.
 * - `automation_webhook_delivery`: an outbox. A run queues a delivery inside its
 *   own savepoint (a failed run queues nothing); the scheduler sends it after
 *   commit, outside any transaction, with up to three tries.
 */
export class AutomationWebhooks1729880000000 implements MigrationInterface {
  name = 'AutomationWebhooks1729880000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    const q = (sql: string) => queryRunner.query(sql);
    await q(`ALTER TABLE automation_rule ADD COLUMN webhook_secret_sealed text`);
    await q(`
      CREATE TABLE automation_webhook_delivery (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        workspace_id uuid NOT NULL REFERENCES workspace(id) ON DELETE CASCADE,
        rule_id uuid NOT NULL REFERENCES automation_rule(id) ON DELETE CASCADE,
        run_id uuid REFERENCES automation_run(id) ON DELETE SET NULL,
        step_id varchar(40) NOT NULL,
        url varchar(500) NOT NULL,
        body text NOT NULL CHECK (length(body) <= 16384),
        status varchar(10) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'failed')),
        attempts integer NOT NULL DEFAULT 0 CHECK (attempts BETWEEN 0 AND 10),
        next_attempt_at timestamptz NOT NULL DEFAULT now(),
        last_detail varchar(200) NOT NULL DEFAULT '',
        created_at timestamptz NOT NULL DEFAULT now()
      )`);
    await q(`CREATE INDEX idx_automation_webhook_due ON automation_webhook_delivery (next_attempt_at) WHERE status = 'pending'`);
    await q(`ALTER TABLE automation_webhook_delivery ENABLE ROW LEVEL SECURITY`);
    await q(`ALTER TABLE automation_webhook_delivery FORCE ROW LEVEL SECURITY`);
    await q(`
      CREATE POLICY tenant_isolation ON automation_webhook_delivery
      USING (app_can_access_workspace(workspace_id))
      WITH CHECK (app_can_access_workspace(workspace_id))`);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE automation_webhook_delivery`);
    await queryRunner.query(`ALTER TABLE automation_rule DROP COLUMN webhook_secret_sealed`);
  }
}
