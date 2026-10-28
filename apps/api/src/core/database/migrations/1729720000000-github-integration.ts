import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * GitHub through repository webhooks: a connection per repository, the
 * deliveries already handled (so a redelivery does nothing twice), and the
 * pull requests linked to tasks. The webhook secret is stored sealed (see
 * core/crypto/secret-box.ts), never in plain text.
 */
export class GithubIntegration1729720000000 implements MigrationInterface {
  name = 'GithubIntegration1729720000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    const q = (sql: string) => queryRunner.query(sql);
    await q(`
      CREATE TABLE github_connection (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        workspace_id uuid NOT NULL REFERENCES workspace(id) ON DELETE CASCADE,
        repo varchar(201) NOT NULL,
        task_prefix varchar(10) NOT NULL DEFAULT 'TF' CHECK (task_prefix ~ '^[A-Z][A-Z0-9]{0,9}$'),
        sync jsonb NOT NULL DEFAULT '{}'::jsonb,
        secret_sealed text NOT NULL,
        created_by_id text REFERENCES "user"(id) ON DELETE SET NULL,
        last_delivery_at timestamptz,
        last_delivery_status varchar(80),
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now()
      )`);
    await q(`CREATE UNIQUE INDEX uq_github_connection_repo ON github_connection (workspace_id, lower(repo))`);

    await q(`
      CREATE TABLE github_delivery (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        workspace_id uuid NOT NULL REFERENCES workspace(id) ON DELETE CASCADE,
        connection_id uuid NOT NULL REFERENCES github_connection(id) ON DELETE CASCADE,
        delivery_id varchar(64) NOT NULL,
        received_at timestamptz NOT NULL DEFAULT now()
      )`);
    await q(`CREATE UNIQUE INDEX uq_github_delivery ON github_delivery (connection_id, delivery_id)`);
    await q(`CREATE INDEX idx_github_delivery_received ON github_delivery (connection_id, received_at)`);

    await q(`
      CREATE TABLE github_pull_request (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        workspace_id uuid NOT NULL REFERENCES workspace(id) ON DELETE CASCADE,
        connection_id uuid NOT NULL REFERENCES github_connection(id) ON DELETE CASCADE,
        task_id uuid NOT NULL REFERENCES task(id) ON DELETE CASCADE,
        repo varchar(201) NOT NULL,
        number integer NOT NULL,
        title varchar(300) NOT NULL,
        url varchar(500) NOT NULL CHECK (url LIKE 'https://github.com/%'),
        state varchar(10) NOT NULL CHECK (state IN ('open', 'merged', 'closed')),
        author varchar(100) NOT NULL DEFAULT '',
        branch varchar(255) NOT NULL DEFAULT '',
        updated_at timestamptz NOT NULL DEFAULT now()
      )`);
    await q(`CREATE UNIQUE INDEX uq_github_pull_request_task ON github_pull_request (task_id, connection_id, number)`);

    for (const table of ['github_connection', 'github_delivery', 'github_pull_request']) {
      await q(`ALTER TABLE ${table} ENABLE ROW LEVEL SECURITY`);
      await q(`ALTER TABLE ${table} FORCE ROW LEVEL SECURITY`);
      await q(`
        CREATE POLICY tenant_isolation ON ${table}
        USING (app_can_access_workspace(workspace_id))
        WITH CHECK (app_can_access_workspace(workspace_id))`);
    }
    // A pull request link is hidden with its task (space-limited roles).
    await q(`
      CREATE POLICY space_access ON github_pull_request AS RESTRICTIVE
      USING (app_task_spaces_unlimited() OR EXISTS (SELECT 1 FROM task WHERE task.id = github_pull_request.task_id))
      WITH CHECK (app_task_spaces_unlimited() OR EXISTS (SELECT 1 FROM task WHERE task.id = github_pull_request.task_id))`);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE github_pull_request`);
    await queryRunner.query(`DROP TABLE github_delivery`);
    await queryRunner.query(`DROP TABLE github_connection`);
  }
}
