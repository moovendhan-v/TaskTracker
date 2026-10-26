import type { MigrationInterface, QueryRunner } from 'typeorm';

/** Free-form key/value data on tasks, filterable as metadata.<key>. */
export class TaskMetadata1729620000000 implements MigrationInterface {
  name = 'TaskMetadata1729620000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE task ADD COLUMN metadata jsonb NOT NULL DEFAULT '{}'::jsonb`);
    await queryRunner.query(`ALTER TABLE task ADD CONSTRAINT chk_task_metadata_object CHECK (jsonb_typeof(metadata) = 'object')`);
    // Containment lookups (metadata @> '{"order_id": "6735"}') and key-existence checks.
    await queryRunner.query(`CREATE INDEX idx_task_metadata ON task USING gin (metadata)`);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS idx_task_metadata`);
    await queryRunner.query(`ALTER TABLE task DROP COLUMN metadata`);
  }
}
