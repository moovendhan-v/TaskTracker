import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * E1 recurring work: a schedule set to run once (not per task) fires once per rule
 * and run date with no task yet (its first step creates one). Those fires have a
 * null task_id, kept unique per rule and key by a partial index.
 */
export class AutomationFireOnce1730150000000 implements MigrationInterface {
  name = 'AutomationFireOnce1730150000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE automation_fire ALTER COLUMN task_id DROP NOT NULL`);
    await queryRunner.query(`CREATE UNIQUE INDEX uq_automation_fire_once ON automation_fire (rule_id, fire_key) WHERE task_id IS NULL`);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX uq_automation_fire_once`);
    await queryRunner.query(`DELETE FROM automation_fire WHERE task_id IS NULL`);
    await queryRunner.query(`ALTER TABLE automation_fire ALTER COLUMN task_id SET NOT NULL`);
  }
}
