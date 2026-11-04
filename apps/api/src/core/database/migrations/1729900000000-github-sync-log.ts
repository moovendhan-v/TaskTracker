import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * E2: a sync log per GitHub connection (what each delivery did), and an inbox
 * of pull requests that mention no task. Both are tenant tables with forced RLS.
 * The log holds our own short text only, never payload content.
 */
export class GithubSyncLog1729900000000 implements MigrationInterface {
  name = 'GithubSyncLog1729900000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    const q = (sql: string) => queryRunner.query(sql);
    await q(`
      CREATE TABLE github_sync_event (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        workspace_id uuid NOT NULL REFERENCES workspace(id) ON DELETE CASCADE,
        connection_id uuid NOT NULL REFERENCES github_connection(id) ON DELETE CASCADE,
        event varchar(40) NOT NULL,
        outcome varchar(10) NOT NULL CHECK (outcome IN ('ok', 'ignored', 'error')),
        detail varchar(200) NOT NULL DEFAULT '',
        pr_number integer,
        task_numbers integer[] NOT NULL DEFAULT '{}' CHECK (cardinality(task_numbers) <= 20),
        created_at timestamptz NOT NULL DEFAULT now()
      )`);
    await q(`CREATE INDEX idx_github_sync_event ON github_sync_event (connection_id, created_at DESC)`);
    await q(`
      CREATE TABLE github_pr_inbox (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        workspace_id uuid NOT NULL REFERENCES workspace(id) ON DELETE CASCADE,
        connection_id uuid NOT NULL REFERENCES github_connection(id) ON DELETE CASCADE,
        repo varchar(201) NOT NULL,
        number integer NOT NULL,
        title varchar(300) NOT NULL DEFAULT '',
        url varchar(500) NOT NULL CHECK (url LIKE 'https://github.com/%'),
        author varchar(100) NOT NULL DEFAULT '',
        branch varchar(255) NOT NULL DEFAULT '',
        state varchar(10) NOT NULL CHECK (state IN ('open', 'merged', 'closed')),
        updated_at timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT uq_github_pr_inbox UNIQUE (connection_id, number)
      )`);
    for (const table of ['github_sync_event', 'github_pr_inbox']) {
      await q(`ALTER TABLE ${table} ENABLE ROW LEVEL SECURITY`);
      await q(`ALTER TABLE ${table} FORCE ROW LEVEL SECURITY`);
      await q(`
        CREATE POLICY tenant_isolation ON ${table}
        USING (app_can_access_workspace(workspace_id))
        WITH CHECK (app_can_access_workspace(workspace_id))`);
    }
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE github_pr_inbox`);
    await queryRunner.query(`DROP TABLE github_sync_event`);
  }
}
