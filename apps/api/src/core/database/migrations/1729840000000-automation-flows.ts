import type { MigrationInterface, QueryRunner } from 'typeorm';

/** E1 flows: a rule's steps as a tree, and the path each run took. Existing RLS covers both columns. */
export class AutomationFlows1729840000000 implements MigrationInterface {
  name = 'AutomationFlows1729840000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE automation_rule ADD COLUMN flow jsonb`);
    await queryRunner.query(`ALTER TABLE automation_rule ADD CONSTRAINT chk_automation_rule_flow CHECK (flow IS NULL OR (jsonb_typeof(flow) = 'object' AND pg_column_size(flow) < 65536))`);
    await queryRunner.query(`ALTER TABLE automation_run ADD COLUMN trace jsonb NOT NULL DEFAULT '[]'::jsonb`);
    await queryRunner.query(`ALTER TABLE automation_run ADD CONSTRAINT chk_automation_run_trace CHECK (jsonb_typeof(trace) = 'array' AND pg_column_size(trace) < 65536)`);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE automation_run DROP COLUMN trace`);
    await queryRunner.query(`ALTER TABLE automation_rule DROP COLUMN flow`);
  }
}
