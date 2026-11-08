import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * E2: conflict cards. Each pull-request link remembers the status sync last left
 * the task in; when a later GitHub event would move a task someone has since moved
 * by hand, sync records a conflict instead of overwriting their change. One open
 * conflict per task and pull request; resolving deletes it (and is audited).
 */
export class GithubConflicts1729950000000 implements MigrationInterface {
  name = 'GithubConflicts1729950000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    const q = (sql: string) => queryRunner.query(sql);
    await q(`ALTER TABLE github_pull_request ADD COLUMN synced_status_id uuid REFERENCES task_status(id) ON DELETE SET NULL`);
    await q(`
      CREATE TABLE github_sync_conflict (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        workspace_id uuid NOT NULL REFERENCES workspace(id) ON DELETE CASCADE,
        connection_id uuid NOT NULL REFERENCES github_connection(id) ON DELETE CASCADE,
        task_id uuid NOT NULL REFERENCES task(id) ON DELETE CASCADE,
        pr_number integer NOT NULL CHECK (pr_number > 0),
        pr_title varchar(300) NOT NULL,
        pr_url varchar(500) NOT NULL,
        event varchar(10) NOT NULL CHECK (event IN ('open', 'merged', 'closed')),
        wanted_status_id uuid NOT NULL REFERENCES task_status(id) ON DELETE CASCADE,
        created_at timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT uq_github_conflict UNIQUE (connection_id, task_id, pr_number)
      )`);
    await q(`CREATE INDEX idx_github_conflict_task ON github_sync_conflict (workspace_id, task_id)`);
    await q(`ALTER TABLE github_sync_conflict ENABLE ROW LEVEL SECURITY`);
    await q(`ALTER TABLE github_sync_conflict FORCE ROW LEVEL SECURITY`);
    await q(`
      CREATE POLICY tenant_isolation ON github_sync_conflict
      USING (app_can_access_workspace(workspace_id)) WITH CHECK (app_can_access_workspace(workspace_id))`);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS github_sync_conflict`);
    await queryRunner.query(`ALTER TABLE github_pull_request DROP COLUMN IF EXISTS synced_status_id`);
  }
}
