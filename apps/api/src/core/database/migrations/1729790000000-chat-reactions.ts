import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Emoji reactions on chat messages. Readable with the channel; you add and remove
 * only your own, and only in an open channel you're in. A trigger keeps a
 * reaction in its message's channel and workspace.
 */
export class ChatReactions1729790000000 implements MigrationInterface {
  name = 'ChatReactions1729790000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    const q = (sql: string) => queryRunner.query(sql);
    await q(`
      CREATE TABLE chat_reaction (
        message_id uuid NOT NULL REFERENCES chat_message(id) ON DELETE CASCADE,
        user_id text NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
        emoji text NOT NULL,
        workspace_id uuid NOT NULL REFERENCES workspace(id) ON DELETE CASCADE,
        channel_id uuid NOT NULL REFERENCES chat_channel(id) ON DELETE CASCADE,
        created_at timestamptz NOT NULL DEFAULT now(),
        PRIMARY KEY (message_id, user_id, emoji),
        CONSTRAINT chk_chat_reaction_emoji CHECK (length(emoji) BETWEEN 1 AND 16)
      )`);
    await q(`CREATE INDEX idx_chat_reaction_message ON chat_reaction (message_id)`);
    await q(`ALTER TABLE chat_reaction ENABLE ROW LEVEL SECURITY`);
    await q(`ALTER TABLE chat_reaction FORCE ROW LEVEL SECURITY`);
    await q(`
      CREATE POLICY chat_reaction_read ON chat_reaction FOR SELECT
      USING (app_can_access_workspace(workspace_id) AND (app_is_platform_scope() OR app_can_read_chat_channel(channel_id)))`);
    await q(`
      CREATE POLICY chat_reaction_insert ON chat_reaction FOR INSERT
      WITH CHECK (app_can_access_workspace(workspace_id) AND user_id = app_current_user_id() AND app_can_post_chat(channel_id))`);
    await q(`
      CREATE POLICY chat_reaction_delete ON chat_reaction FOR DELETE
      USING (app_can_access_workspace(workspace_id) AND user_id = app_current_user_id())`);
    await q(`
      CREATE FUNCTION chat_reaction_guard() RETURNS trigger LANGUAGE plpgsql AS $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM chat_message m
          WHERE m.id = NEW.message_id AND m.channel_id = NEW.channel_id AND m.workspace_id = NEW.workspace_id AND m.deleted_at IS NULL
        ) THEN
          RAISE EXCEPTION 'a reaction must belong to a live message in its channel' USING ERRCODE = 'check_violation';
        END IF;
        RETURN NEW;
      END $$`);
    await q(`CREATE TRIGGER trg_chat_reaction_guard BEFORE INSERT ON chat_reaction FOR EACH ROW EXECUTE FUNCTION chat_reaction_guard()`);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS chat_reaction`);
    await queryRunner.query(`DROP FUNCTION IF EXISTS chat_reaction_guard()`);
  }
}
