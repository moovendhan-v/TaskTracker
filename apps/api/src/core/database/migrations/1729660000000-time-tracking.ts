import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Time tracking: timers and logged time, on a task or on a space without one.
 * A running timer has no end; each person has at most one per workspace.
 */
export class TimeTracking1729660000000 implements MigrationInterface {
  name = 'TimeTracking1729660000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    const q = (sql: string) => queryRunner.query(sql);
    await q(`
      CREATE TABLE time_entry (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        workspace_id uuid NOT NULL REFERENCES workspace(id) ON DELETE CASCADE,
        user_id text NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
        task_id uuid REFERENCES task(id) ON DELETE SET NULL,
        space_id uuid REFERENCES space(id) ON DELETE SET NULL,
        started_at timestamptz NOT NULL,
        ended_at timestamptz,
        minutes integer NOT NULL DEFAULT 0 CHECK (minutes BETWEEN 0 AND 1440),
        note varchar(1000) NOT NULL DEFAULT '',
        activity varchar(40) NOT NULL DEFAULT '',
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT chk_time_entry_span CHECK (ended_at IS NULL OR (ended_at > started_at AND ended_at - started_at <= interval '24 hours'))
      )`);
    await q(`CREATE UNIQUE INDEX uq_time_entry_running ON time_entry (workspace_id, user_id) WHERE ended_at IS NULL`);
    await q(`CREATE INDEX idx_time_entry_started ON time_entry (workspace_id, started_at)`);
    await q(`CREATE INDEX idx_time_entry_user ON time_entry (workspace_id, user_id, started_at)`);
    await q(`CREATE INDEX idx_time_entry_task ON time_entry (task_id) WHERE task_id IS NOT NULL`);

    await q(`ALTER TABLE time_entry ENABLE ROW LEVEL SECURITY`);
    await q(`ALTER TABLE time_entry FORCE ROW LEVEL SECURITY`);
    await q(`
      CREATE POLICY tenant_isolation ON time_entry
      USING (app_can_access_workspace(workspace_id))
      WITH CHECK (app_can_access_workspace(workspace_id))`);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE time_entry`);
  }
}
