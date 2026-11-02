import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Files attached to chat messages. The bytes live in private storage under a
 * server-made key; this row says who may see them. Readable by the uploader,
 * and by anyone who can read the channel once the file is on a message.
 * Only the uploader changes or removes their own, and a file joins at most one
 * message, theirs, in the same channel.
 */
export class ChatAttachments1729810000000 implements MigrationInterface {
  name = 'ChatAttachments1729810000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    const q = (sql: string) => queryRunner.query(sql);
    await q(`
      CREATE TABLE chat_attachment (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        workspace_id uuid NOT NULL REFERENCES workspace(id) ON DELETE CASCADE,
        channel_id uuid NOT NULL REFERENCES chat_channel(id) ON DELETE CASCADE,
        uploader_id text NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
        message_id uuid REFERENCES chat_message(id) ON DELETE CASCADE,
        file_name text NOT NULL,
        content_type text,
        declared_size bigint NOT NULL,
        size bigint,
        storage_key text NOT NULL UNIQUE,
        status text NOT NULL DEFAULT 'pending',
        created_at timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT chk_chat_attachment_status CHECK (status IN ('pending', 'ready')),
        CONSTRAINT chk_chat_attachment_name CHECK (length(file_name) BETWEEN 1 AND 200),
        CONSTRAINT chk_chat_attachment_size CHECK (declared_size > 0 AND (size IS NULL OR size > 0)),
        CONSTRAINT chk_chat_attachment_ready CHECK (status = 'pending' OR (content_type IS NOT NULL AND size IS NOT NULL)),
        CONSTRAINT chk_chat_attachment_message CHECK (message_id IS NULL OR status = 'ready')
      )`);
    // A message may be only files now; the service still requires text or at least one file.
    await q(`ALTER TABLE chat_message DROP CONSTRAINT chk_chat_message_body`);
    await q(`ALTER TABLE chat_message ADD CONSTRAINT chk_chat_message_body CHECK (length(body) <= 4000)`);
    await q(`CREATE INDEX idx_chat_attachment_message ON chat_attachment (message_id) WHERE message_id IS NOT NULL`);
    await q(`CREATE INDEX idx_chat_attachment_pending ON chat_attachment (created_at) WHERE message_id IS NULL`);
    await q(`ALTER TABLE chat_attachment ENABLE ROW LEVEL SECURITY`);
    await q(`ALTER TABLE chat_attachment FORCE ROW LEVEL SECURITY`);
    await q(`
      CREATE POLICY chat_attachment_read ON chat_attachment FOR SELECT
      USING (app_can_access_workspace(workspace_id) AND (
        app_is_platform_scope() OR uploader_id = app_current_user_id()
        OR (message_id IS NOT NULL AND app_can_read_chat_channel(channel_id))))`);
    await q(`
      CREATE POLICY chat_attachment_insert ON chat_attachment FOR INSERT
      WITH CHECK (app_can_access_workspace(workspace_id) AND uploader_id = app_current_user_id() AND app_can_post_chat(channel_id) AND message_id IS NULL)`);
    await q(`
      CREATE POLICY chat_attachment_update ON chat_attachment FOR UPDATE
      USING (app_can_access_workspace(workspace_id) AND uploader_id = app_current_user_id())
      WITH CHECK (app_can_access_workspace(workspace_id) AND uploader_id = app_current_user_id())`);
    await q(`
      CREATE POLICY chat_attachment_delete ON chat_attachment FOR DELETE
      USING (app_can_access_workspace(workspace_id) AND (app_is_platform_scope() OR uploader_id = app_current_user_id()))`);
    await q(`
      CREATE FUNCTION chat_attachment_guard() RETURNS trigger LANGUAGE plpgsql AS $$
      BEGIN
        IF NEW.workspace_id <> OLD.workspace_id OR NEW.channel_id <> OLD.channel_id OR NEW.uploader_id <> OLD.uploader_id
           OR NEW.storage_key <> OLD.storage_key OR NEW.file_name <> OLD.file_name OR NEW.declared_size <> OLD.declared_size THEN
          RAISE EXCEPTION 'an attachment can only be checked and attached' USING ERRCODE = 'check_violation';
        END IF;
        IF OLD.message_id IS NOT NULL AND NEW.message_id IS DISTINCT FROM OLD.message_id THEN
          RAISE EXCEPTION 'an attachment belongs to one message' USING ERRCODE = 'check_violation';
        END IF;
        IF NEW.message_id IS NOT NULL AND OLD.message_id IS NULL AND NOT EXISTS (
          SELECT 1 FROM chat_message m
          WHERE m.id = NEW.message_id AND m.channel_id = NEW.channel_id AND m.author_id = NEW.uploader_id AND m.deleted_at IS NULL
        ) THEN
          RAISE EXCEPTION 'attach files only to your own message in the same channel' USING ERRCODE = 'check_violation';
        END IF;
        RETURN NEW;
      END $$`);
    await q(`CREATE TRIGGER trg_chat_attachment_guard BEFORE UPDATE ON chat_attachment FOR EACH ROW EXECUTE FUNCTION chat_attachment_guard()`);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS chat_attachment`);
    await queryRunner.query(`DROP FUNCTION IF EXISTS chat_attachment_guard()`);
    await queryRunner.query(`ALTER TABLE chat_message DROP CONSTRAINT chk_chat_message_body`);
    await queryRunner.query(`ALTER TABLE chat_message ADD CONSTRAINT chk_chat_message_body CHECK (length(body) <= 4000 AND (deleted_at IS NOT NULL OR length(btrim(body)) > 0))`);
  }
}
