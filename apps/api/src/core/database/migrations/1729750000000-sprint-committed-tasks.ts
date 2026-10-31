import type { MigrationInterface, QueryRunner } from 'typeorm';

/** How many tasks a sprint held when it was completed, so velocity can show committed vs done. */
export class SprintCommittedTasks1729750000000 implements MigrationInterface {
  name = 'SprintCommittedTasks1729750000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE sprint ADD COLUMN IF NOT EXISTS committed_tasks integer`);
    await queryRunner.query(`ALTER TABLE sprint ADD CONSTRAINT chk_sprint_committed_tasks CHECK (committed_tasks IS NULL OR committed_tasks >= 0)`);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE sprint DROP CONSTRAINT IF EXISTS chk_sprint_committed_tasks`);
    await queryRunner.query(`ALTER TABLE sprint DROP COLUMN IF EXISTS committed_tasks`);
  }
}
