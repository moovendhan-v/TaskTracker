import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * C1 board column limits: an optional work-in-progress limit per status. The
 * board warns when a column reaches or passes it; nothing is blocked. Lives on
 * task_status, so its existing tenant and space RLS covers it.
 */
export class StatusWipLimit1730110000000 implements MigrationInterface {
  name = 'StatusWipLimit1730110000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE task_status ADD COLUMN wip_limit smallint CONSTRAINT chk_task_status_wip_limit CHECK (wip_limit BETWEEN 1 AND 999)`);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE task_status DROP COLUMN wip_limit`);
  }
}
