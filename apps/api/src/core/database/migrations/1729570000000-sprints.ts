import type { MigrationInterface, QueryRunner } from 'typeorm';

export class Sprints1729570000000 implements MigrationInterface {
  name = 'Sprints1729570000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE sprint (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        workspace_id uuid NOT NULL REFERENCES workspace(id) ON DELETE CASCADE,
        space_id uuid NOT NULL REFERENCES space(id) ON DELETE CASCADE,
        name varchar(80) NOT NULL,
        goal varchar(500) NOT NULL DEFAULT '',
        start_date date NOT NULL,
        end_date date NOT NULL,
        status varchar(12) NOT NULL DEFAULT 'planned' CHECK (status IN ('planned', 'active', 'completed')),
        completed_at timestamptz,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT chk_sprint_dates CHECK (end_date >= start_date)
      )`);
    await queryRunner.query(`CREATE INDEX idx_sprint_workspace_space_start ON sprint (workspace_id, space_id, start_date)`);
    // Backstop for the lifecycle policy: at most one active sprint per space, even under concurrent requests.
    await queryRunner.query(`CREATE UNIQUE INDEX uq_sprint_one_active_per_space ON sprint (space_id) WHERE status = 'active'`);

    await queryRunner.query(`ALTER TABLE task ADD COLUMN sprint_id uuid REFERENCES sprint(id) ON DELETE SET NULL`);
    await queryRunner.query(`CREATE INDEX idx_task_workspace_sprint ON task (workspace_id, sprint_id)`);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE task DROP COLUMN IF EXISTS sprint_id`);
    await queryRunner.query(`DROP TABLE IF EXISTS sprint`);
  }
}
