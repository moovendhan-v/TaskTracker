import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * E3: access requests you approve in one click, as grants that always end.
 *
 * - access_request: who asked for what (and where), and what happened to it.
 * - access_grant: one permission for one person, in one project or the whole
 *   workspace, until expires_at. Read in the workspace scope, and by the person
 *   themselves in the user scope (their membership lookup needs it); written only
 *   inside the workspace, after the service's checks (roles.manage, and you can't
 *   hand out what you don't have).
 * - notification kind access_decided tells the requester.
 */
export class AccessGrants1729960000000 implements MigrationInterface {
  name = 'AccessGrants1729960000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    const q = (sql: string) => queryRunner.query(sql);
    await q(`
      CREATE TABLE access_request (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        workspace_id uuid NOT NULL REFERENCES workspace(id) ON DELETE CASCADE,
        requester_id text NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
        permission varchar(60) NOT NULL,
        space_id uuid REFERENCES space(id) ON DELETE CASCADE,
        note varchar(200) NOT NULL DEFAULT '',
        status varchar(10) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'declined')),
        decided_by text REFERENCES "user"(id) ON DELETE SET NULL,
        decided_at timestamptz,
        created_at timestamptz NOT NULL DEFAULT now()
      )`);
    await q(`CREATE INDEX idx_access_request_pending ON access_request (workspace_id, created_at DESC) WHERE status = 'pending'`);
    await q(`
      CREATE TABLE access_grant (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        workspace_id uuid NOT NULL REFERENCES workspace(id) ON DELETE CASCADE,
        user_id text NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
        permission varchar(60) NOT NULL,
        space_id uuid REFERENCES space(id) ON DELETE CASCADE,
        expires_at timestamptz NOT NULL,
        granted_by text REFERENCES "user"(id) ON DELETE SET NULL,
        request_id uuid REFERENCES access_request(id) ON DELETE SET NULL,
        created_at timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT chk_access_grant_expiry CHECK (expires_at > created_at AND expires_at <= created_at + interval '31 days')
      )`);
    await q(`CREATE INDEX idx_access_grant_user ON access_grant (workspace_id, user_id, expires_at)`);
    for (const table of ['access_request', 'access_grant']) {
      await q(`ALTER TABLE ${table} ENABLE ROW LEVEL SECURITY`);
      await q(`ALTER TABLE ${table} FORCE ROW LEVEL SECURITY`);
    }
    await q(`
      CREATE POLICY tenant_isolation ON access_request
      USING (app_can_access_workspace(workspace_id)) WITH CHECK (app_can_access_workspace(workspace_id))`);
    await q(`CREATE POLICY access_grant_read ON access_grant FOR SELECT USING (app_can_access_workspace(workspace_id) OR user_id = app_current_user_id())`);
    await q(`CREATE POLICY access_grant_insert ON access_grant FOR INSERT WITH CHECK (app_can_access_workspace(workspace_id) AND granted_by = app_current_user_id() AND user_id <> app_current_user_id())`);
    await q(`CREATE POLICY access_grant_delete ON access_grant FOR DELETE USING (app_can_access_workspace(workspace_id))`);

    await q(`ALTER TABLE notification DROP CONSTRAINT notification_kind_check`);
    await q(`
      ALTER TABLE notification ADD CONSTRAINT notification_kind_check
      CHECK (kind IN ('task_assigned', 'task_commented', 'leave_requested', 'leave_decided', 'member_added', 'automation', 'chat_mention', 'access_requested', 'access_decided'))`);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DELETE FROM notification WHERE kind = 'access_decided'`);
    await queryRunner.query(`ALTER TABLE notification DROP CONSTRAINT notification_kind_check`);
    await queryRunner.query(`
      ALTER TABLE notification ADD CONSTRAINT notification_kind_check
      CHECK (kind IN ('task_assigned', 'task_commented', 'leave_requested', 'leave_decided', 'member_added', 'automation', 'chat_mention', 'access_requested'))`);
    await queryRunner.query(`DROP TABLE IF EXISTS access_grant`);
    await queryRunner.query(`DROP TABLE IF EXISTS access_request`);
  }
}
