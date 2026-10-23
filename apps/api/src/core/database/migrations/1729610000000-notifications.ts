import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Per-user notifications inside a workspace (the Inbox). Row-level security
 * like every tenant table; repositories also filter by recipient.
 */
export class Notifications1729610000000 implements MigrationInterface {
  name = 'Notifications1729610000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE notification (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        workspace_id uuid NOT NULL REFERENCES workspace(id) ON DELETE CASCADE,
        recipient_id text NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
        actor_id text REFERENCES "user"(id) ON DELETE SET NULL,
        kind varchar(30) NOT NULL CHECK (kind IN ('task_assigned', 'task_commented', 'leave_requested', 'leave_decided', 'member_added')),
        entity_type varchar(30) NOT NULL,
        entity_id varchar(64) NOT NULL,
        task_id uuid REFERENCES task(id) ON DELETE CASCADE,
        subject varchar(300) NOT NULL,
        excerpt varchar(300) NOT NULL DEFAULT '',
        read_at timestamptz,
        created_at timestamptz NOT NULL DEFAULT now()
      )`);
    await queryRunner.query(
      `CREATE INDEX idx_notification_inbox ON notification (workspace_id, recipient_id, created_at DESC)`,
    );
    await queryRunner.query(
      `CREATE INDEX idx_notification_unread ON notification (workspace_id, recipient_id) WHERE read_at IS NULL`,
    );
    await queryRunner.query(`ALTER TABLE notification ENABLE ROW LEVEL SECURITY`);
    await queryRunner.query(`ALTER TABLE notification FORCE ROW LEVEL SECURITY`);
    await queryRunner.query(`
      CREATE POLICY tenant_isolation ON notification
      USING (app_can_access_workspace(workspace_id))
      WITH CHECK (app_can_access_workspace(workspace_id))`);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS notification`);
  }
}
