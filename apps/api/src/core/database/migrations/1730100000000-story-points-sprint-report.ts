import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * C3 story points and the sprint report.
 *
 * - `task.story_points`: a whole number 0–100, null when not estimated.
 * - `sprint.started_at` and `sprint.committed_points` (points in the sprint when
 *   it was completed, before unfinished work moved out), next to committed_tasks.
 * - `sprint_task_snapshot`: the sprint's tasks when it starts ('start') and when
 *   it completes ('end', with the outcome and where unfinished work went), so the
 *   report can show what was committed, what was added or removed mid-sprint, and
 *   what got done. Titles are copied, so a deleted task still shows.
 *
 * RLS: tenant rows only, and only for spaces the person can see tasks in (like
 * the task table itself).
 */
export class StoryPointsSprintReport1730100000000 implements MigrationInterface {
  name = 'StoryPointsSprintReport1730100000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    const q = (sql: string) => queryRunner.query(sql);
    await q(`ALTER TABLE task ADD COLUMN story_points smallint CONSTRAINT chk_task_story_points CHECK (story_points BETWEEN 0 AND 100)`);
    await q(`
      ALTER TABLE sprint
        ADD COLUMN started_at timestamptz,
        ADD COLUMN committed_points integer CONSTRAINT chk_sprint_committed_points CHECK (committed_points IS NULL OR committed_points >= 0)`);
    await q(`
      CREATE TABLE sprint_task_snapshot (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        workspace_id uuid NOT NULL REFERENCES workspace(id) ON DELETE CASCADE,
        space_id uuid NOT NULL REFERENCES space(id) ON DELETE CASCADE,
        sprint_id uuid NOT NULL REFERENCES sprint(id) ON DELETE CASCADE,
        task_id uuid REFERENCES task(id) ON DELETE SET NULL,
        phase varchar(5) NOT NULL CHECK (phase IN ('start', 'end')),
        number integer NOT NULL,
        title varchar(200) NOT NULL,
        story_points smallint CHECK (story_points BETWEEN 0 AND 100),
        status_category varchar(12) NOT NULL,
        destination varchar(40),
        created_at timestamptz NOT NULL DEFAULT now()
      )`);
    await q(`CREATE UNIQUE INDEX uq_sprint_snapshot_task ON sprint_task_snapshot (sprint_id, phase, task_id)`);
    await q(`CREATE INDEX idx_sprint_snapshot_sprint ON sprint_task_snapshot (workspace_id, sprint_id, phase)`);
    await q(`ALTER TABLE sprint_task_snapshot ENABLE ROW LEVEL SECURITY`);
    await q(`ALTER TABLE sprint_task_snapshot FORCE ROW LEVEL SECURITY`);
    await q(`
      CREATE POLICY tenant_isolation ON sprint_task_snapshot
      USING (app_can_access_workspace(workspace_id)) WITH CHECK (app_can_access_workspace(workspace_id))`);
    await q(`
      CREATE POLICY space_access ON sprint_task_snapshot AS RESTRICTIVE
      USING (app_task_space_visible(space_id)) WITH CHECK (app_task_space_visible(space_id))`);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    const q = (sql: string) => queryRunner.query(sql);
    await q(`DROP TABLE sprint_task_snapshot`);
    await q(`ALTER TABLE sprint DROP COLUMN committed_points, DROP COLUMN started_at`);
    await q(`ALTER TABLE task DROP COLUMN story_points`);
  }
}
