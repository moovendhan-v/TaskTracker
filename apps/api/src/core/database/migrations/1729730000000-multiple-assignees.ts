import type { MigrationInterface, QueryRunner } from 'typeorm';

export class MultipleAssignees1729730000000 implements MigrationInterface {
  name = 'MultipleAssignees1729730000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    const q = (sql: string) => queryRunner.query(sql);
    await q(`ALTER TABLE task ADD COLUMN IF NOT EXISTS assignee_ids text[] NOT NULL DEFAULT '{}'`);
    await q(`UPDATE task SET assignee_ids = ARRAY[assignee_id] WHERE assignee_id IS NOT NULL AND assignee_ids = '{}'`);
    await q(`CREATE INDEX IF NOT EXISTS idx_task_assignee_ids ON task USING gin (assignee_ids)`);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    const q = (sql: string) => queryRunner.query(sql);
    await q(`DROP INDEX IF EXISTS idx_task_assignee_ids`);
    await q(`ALTER TABLE task DROP COLUMN IF EXISTS assignee_ids`);
  }
}
