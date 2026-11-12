import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Two-way GitHub sync through the TaskFlow GitHub App (E2):
 *
 * - github_installation: an app installation a workspace may use. Kept only after GitHub
 *   confirmed the person who installed it can reach that installation.
 * - github_connection: a repository connected through an installation has no webhook secret;
 *   the poller keeps cursors of what it has seen.
 * - github_issue: a task linked to an issue, with the title and open / closed state sync last
 *   agreed on (so echoes aren't applied twice) and whether TaskFlow's side still has to be sent.
 */
export class GithubApp1730020000000 implements MigrationInterface {
  name = 'GithubApp1730020000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    const q = (sql: string) => queryRunner.query(sql);
    await q(`
      CREATE TABLE github_installation (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        workspace_id uuid NOT NULL REFERENCES workspace(id) ON DELETE CASCADE,
        installation_id bigint NOT NULL CHECK (installation_id > 0),
        account_login varchar(100) NOT NULL,
        account_type varchar(20) NOT NULL CHECK (account_type IN ('User', 'Organization')),
        installed_by_id text REFERENCES "user"(id) ON DELETE SET NULL,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now(),
        UNIQUE (id, workspace_id)
      )`);
    await q(`CREATE UNIQUE INDEX uq_github_installation ON github_installation (workspace_id, installation_id)`);

    await q(`ALTER TABLE github_connection ALTER COLUMN secret_sealed DROP NOT NULL`);
    await q(`ALTER TABLE github_connection ADD COLUMN installation_ref uuid`);
    // The installation must be one of the same workspace's.
    await q(`
      ALTER TABLE github_connection ADD CONSTRAINT fk_github_connection_installation
        FOREIGN KEY (installation_ref, workspace_id) REFERENCES github_installation(id, workspace_id) ON DELETE CASCADE`);
    await q(`ALTER TABLE github_connection ADD CONSTRAINT ck_github_connection_kind CHECK (secret_sealed IS NOT NULL OR installation_ref IS NOT NULL)`);
    await q(`ALTER TABLE github_connection ADD COLUMN pulls_cursor timestamptz, ADD COLUMN issues_cursor timestamptz, ADD COLUMN polled_at timestamptz`);
    await q(`CREATE INDEX idx_github_connection_app ON github_connection (polled_at) WHERE installation_ref IS NOT NULL`);

    await q(`
      CREATE TABLE github_issue (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        workspace_id uuid NOT NULL REFERENCES workspace(id) ON DELETE CASCADE,
        connection_id uuid NOT NULL REFERENCES github_connection(id) ON DELETE CASCADE,
        task_id uuid NOT NULL REFERENCES task(id) ON DELETE CASCADE,
        number integer NOT NULL CHECK (number > 0),
        url varchar(500) NOT NULL CHECK (url LIKE 'https://github.com/%'),
        synced_title varchar(300) NOT NULL,
        synced_closed boolean NOT NULL,
        push_due boolean NOT NULL DEFAULT false,
        push_version integer NOT NULL DEFAULT 0,
        push_attempts integer NOT NULL DEFAULT 0,
        push_at timestamptz,
        last_error varchar(200),
        created_by_id text REFERENCES "user"(id) ON DELETE SET NULL,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now()
      )`);
    await q(`CREATE UNIQUE INDEX uq_github_issue_number ON github_issue (connection_id, number)`);
    await q(`CREATE UNIQUE INDEX uq_github_issue_task ON github_issue (task_id, connection_id)`);
    await q(`CREATE INDEX idx_github_issue_push ON github_issue (workspace_id, push_at) WHERE push_due`);

    for (const table of ['github_installation', 'github_issue']) {
      await q(`ALTER TABLE ${table} ENABLE ROW LEVEL SECURITY`);
      await q(`ALTER TABLE ${table} FORCE ROW LEVEL SECURITY`);
      await q(`
        CREATE POLICY tenant_isolation ON ${table}
        USING (app_can_access_workspace(workspace_id))
        WITH CHECK (app_can_access_workspace(workspace_id))`);
    }
    // An issue link is hidden with its task (space-limited roles), like pull request links.
    await q(`
      CREATE POLICY space_access ON github_issue AS RESTRICTIVE
      USING (app_task_spaces_unlimited() OR EXISTS (SELECT 1 FROM task WHERE task.id = github_issue.task_id))
      WITH CHECK (app_task_spaces_unlimited() OR EXISTS (SELECT 1 FROM task WHERE task.id = github_issue.task_id))`);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    const q = (sql: string) => queryRunner.query(sql);
    await q(`DROP TABLE github_issue`);
    await q(`DELETE FROM github_connection WHERE secret_sealed IS NULL`);
    await q(`ALTER TABLE github_connection DROP CONSTRAINT ck_github_connection_kind, DROP CONSTRAINT fk_github_connection_installation`);
    await q(`ALTER TABLE github_connection DROP COLUMN installation_ref, DROP COLUMN pulls_cursor, DROP COLUMN issues_cursor, DROP COLUMN polled_at`);
    await q(`ALTER TABLE github_connection ALTER COLUMN secret_sealed SET NOT NULL`);
    await q(`DROP TABLE github_installation`);
  }
}
