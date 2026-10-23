import type { MigrationInterface, QueryRunner } from 'typeorm';

export class TaskComments1729560000000 implements MigrationInterface {
  name = 'TaskComments1729560000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE task_comment (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        workspace_id uuid NOT NULL REFERENCES workspace(id) ON DELETE CASCADE,
        task_id uuid NOT NULL REFERENCES task(id) ON DELETE CASCADE,
        author_id text NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
        body text NOT NULL CHECK (char_length(body) BETWEEN 1 AND 5000),
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now()
      )`);
    await queryRunner.query(
      `CREATE INDEX idx_task_comment_workspace_task_created ON task_comment (workspace_id, task_id, created_at)`,
    );
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS task_comment`);
  }
}
