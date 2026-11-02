import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Chat (D1): channels, memberships and messages. See docs/plan/D1_CHAT.md.
 *
 * Who can read what, enforced here and not only in the service:
 * - A channel is readable when it is public in your workspace, or you are a member.
 * - Messages follow their channel. Private channels and DMs don't exist for anyone else.
 * - Membership rows are readable workspace-wide: a policy on chat_member can't read
 *   chat_member itself (Postgres rejects the recursion, and the owner role doesn't
 *   bypass RLS). The service only returns members of channels you can read.
 *
 * Triggers keep the columns that RLS can't police from being changed:
 * a member can't promote themselves, and a message can't move between
 * channels, authors or threads.
 */
export class Chat1729770000000 implements MigrationInterface {
  name = 'Chat1729770000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    const q = (sql: string) => queryRunner.query(sql);

    await q(`
      CREATE TABLE chat_channel (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        workspace_id uuid NOT NULL REFERENCES workspace(id) ON DELETE CASCADE,
        kind text NOT NULL,
        name text,
        topic text NOT NULL DEFAULT '',
        dm_key text,
        created_by text REFERENCES "user"(id) ON DELETE SET NULL,
        archived_at timestamptz,
        created_at timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT chk_chat_channel_kind CHECK (kind IN ('public', 'private', 'dm')),
        CONSTRAINT chk_chat_channel_name CHECK (
          (kind = 'dm' AND name IS NULL AND dm_key IS NOT NULL)
          OR (kind <> 'dm' AND dm_key IS NULL AND name ~ '^[a-z0-9][a-z0-9_-]{0,79}$')),
        CONSTRAINT chk_chat_channel_topic CHECK (length(topic) <= 250)
      )`);
    await q(`CREATE UNIQUE INDEX uq_chat_channel_name ON chat_channel (workspace_id, name) WHERE name IS NOT NULL`);
    await q(`CREATE UNIQUE INDEX uq_chat_channel_dm ON chat_channel (workspace_id, dm_key) WHERE dm_key IS NOT NULL`);
    await q(`CREATE INDEX idx_chat_channel_workspace ON chat_channel (workspace_id, kind)`);

    await q(`
      CREATE TABLE chat_member (
        channel_id uuid NOT NULL REFERENCES chat_channel(id) ON DELETE CASCADE,
        user_id text NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
        workspace_id uuid NOT NULL REFERENCES workspace(id) ON DELETE CASCADE,
        role text NOT NULL DEFAULT 'member',
        last_read_at timestamptz,
        muted boolean NOT NULL DEFAULT false,
        joined_at timestamptz NOT NULL DEFAULT now(),
        PRIMARY KEY (channel_id, user_id),
        CONSTRAINT chk_chat_member_role CHECK (role IN ('owner', 'member'))
      )`);
    await q(`CREATE INDEX idx_chat_member_user ON chat_member (workspace_id, user_id)`);

    await q(`
      CREATE TABLE chat_message (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        workspace_id uuid NOT NULL REFERENCES workspace(id) ON DELETE CASCADE,
        channel_id uuid NOT NULL REFERENCES chat_channel(id) ON DELETE CASCADE,
        author_id text REFERENCES "user"(id) ON DELETE SET NULL,
        parent_id uuid REFERENCES chat_message(id) ON DELETE CASCADE,
        kind text NOT NULL DEFAULT 'user',
        body text NOT NULL,
        task_id uuid REFERENCES task(id) ON DELETE SET NULL,
        edited_at timestamptz,
        deleted_at timestamptz,
        created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
        CONSTRAINT chk_chat_message_kind CHECK (kind IN ('user', 'system')),
        CONSTRAINT chk_chat_message_body CHECK (length(body) <= 4000 AND (deleted_at IS NOT NULL OR length(btrim(body)) > 0))
      )`);
    await q(`CREATE INDEX idx_chat_message_channel ON chat_message (channel_id, created_at DESC, id DESC) WHERE parent_id IS NULL`);
    await q(`CREATE INDEX idx_chat_message_thread ON chat_message (parent_id, created_at, id) WHERE parent_id IS NOT NULL`);
    await q(`CREATE INDEX idx_chat_message_unread ON chat_message (channel_id, created_at)`);
    await q(`CREATE INDEX idx_chat_message_task ON chat_message (task_id) WHERE task_id IS NOT NULL`);

    // Helpers. Plain (invoker) functions: they read through the caller's own RLS.
    await q(`
      CREATE FUNCTION app_chat_role(channel uuid) RETURNS text LANGUAGE sql STABLE AS $$
        SELECT role FROM chat_member WHERE channel_id = channel AND user_id = app_current_user_id()
      $$`);
    await q(`
      CREATE FUNCTION app_can_read_chat_channel(channel uuid) RETURNS boolean LANGUAGE sql STABLE AS $$
        SELECT EXISTS (SELECT 1 FROM chat_channel WHERE id = channel)
      $$`);
    await q(`
      CREATE FUNCTION app_chat_has_members(channel uuid) RETURNS boolean LANGUAGE sql STABLE AS $$
        SELECT EXISTS (SELECT 1 FROM chat_member WHERE channel_id = channel)
      $$`);
    await q(`
      CREATE FUNCTION app_can_post_chat(channel uuid) RETURNS boolean LANGUAGE sql STABLE AS $$
        SELECT app_chat_role(channel) IS NOT NULL
          AND EXISTS (SELECT 1 FROM chat_channel WHERE id = channel AND archived_at IS NULL)
      $$`);

    for (const table of ['chat_channel', 'chat_member', 'chat_message']) {
      await q(`ALTER TABLE ${table} ENABLE ROW LEVEL SECURITY`);
      await q(`ALTER TABLE ${table} FORCE ROW LEVEL SECURITY`);
    }

    // Channels: public ones, or ones you're in.
    await q(`
      CREATE POLICY chat_channel_read ON chat_channel FOR SELECT
      USING (app_can_access_workspace(workspace_id) AND (
        app_is_platform_scope() OR kind = 'public' OR app_chat_role(id) IS NOT NULL
        -- the creator, between creating a channel and joining it as its first owner
        OR (created_by = app_current_user_id() AND NOT app_chat_has_members(id))))`);
    await q(`
      CREATE POLICY chat_channel_insert ON chat_channel FOR INSERT
      WITH CHECK (app_can_access_workspace(workspace_id) AND created_by = app_current_user_id())`);
    // Owners change their channels; public channels can also be changed by admins (chat.manage, checked in the service).
    await q(`
      CREATE POLICY chat_channel_update ON chat_channel FOR UPDATE
      USING (app_can_access_workspace(workspace_id) AND (app_is_platform_scope() OR kind = 'public' OR app_chat_role(id) = 'owner'))
      WITH CHECK (app_can_access_workspace(workspace_id))`);

    // Memberships: readable in the workspace (see above). Rows go in by joining a public channel, by an owner adding
    // people, or by the creator becoming the first owner of a channel they just made.
    await q(`
      CREATE POLICY chat_member_read ON chat_member FOR SELECT
      USING (app_can_access_workspace(workspace_id))`);
    await q(`
      CREATE POLICY chat_member_insert ON chat_member FOR INSERT
      WITH CHECK (app_can_access_workspace(workspace_id) AND (
        app_is_platform_scope()
        OR app_chat_role(channel_id) = 'owner'
        OR EXISTS (
          SELECT 1 FROM chat_channel c WHERE c.id = channel_id AND c.workspace_id = chat_member.workspace_id AND c.archived_at IS NULL
            AND ((c.kind = 'public' AND user_id = app_current_user_id() AND role = 'member') OR (c.created_by = app_current_user_id() AND user_id = app_current_user_id() AND role = 'owner' AND NOT app_chat_has_members(c.id)))
        )))`);
    await q(`
      CREATE POLICY chat_member_update ON chat_member FOR UPDATE
      USING (app_can_access_workspace(workspace_id) AND (app_is_platform_scope() OR user_id = app_current_user_id() OR app_chat_role(channel_id) = 'owner'))
      WITH CHECK (app_can_access_workspace(workspace_id))`);
    await q(`
      CREATE POLICY chat_member_delete ON chat_member FOR DELETE
      USING (app_can_access_workspace(workspace_id) AND (app_is_platform_scope() OR user_id = app_current_user_id() OR app_chat_role(channel_id) = 'owner'))`);

    // Messages: read with the channel; post as yourself into an open channel you're in; edit only your own.
    await q(`
      CREATE POLICY chat_message_read ON chat_message FOR SELECT
      USING (app_can_access_workspace(workspace_id) AND (app_is_platform_scope() OR app_can_read_chat_channel(channel_id)))`);
    await q(`
      CREATE POLICY chat_message_insert ON chat_message FOR INSERT
      WITH CHECK (app_can_access_workspace(workspace_id) AND author_id = app_current_user_id() AND app_can_post_chat(channel_id))`);
    await q(`
      CREATE POLICY chat_message_update ON chat_message FOR UPDATE
      USING (app_can_access_workspace(workspace_id) AND author_id = app_current_user_id())
      WITH CHECK (app_can_access_workspace(workspace_id) AND author_id = app_current_user_id())`);

    // Columns RLS can't police.
    await q(`
      CREATE FUNCTION chat_member_guard() RETURNS trigger LANGUAGE plpgsql AS $$
      BEGIN
        IF NEW.channel_id <> OLD.channel_id OR NEW.user_id <> OLD.user_id OR NEW.workspace_id <> OLD.workspace_id OR NEW.joined_at <> OLD.joined_at THEN
          RAISE EXCEPTION 'chat membership identity cannot change' USING ERRCODE = 'check_violation';
        END IF;
        IF NEW.role <> OLD.role AND NOT app_is_platform_scope() AND coalesce(app_chat_role(NEW.channel_id), '') <> 'owner' THEN
          RAISE EXCEPTION 'only a channel owner can change roles' USING ERRCODE = 'insufficient_privilege';
        END IF;
        IF (NEW.last_read_at IS DISTINCT FROM OLD.last_read_at OR NEW.muted <> OLD.muted) AND OLD.user_id <> coalesce(app_current_user_id(), '') AND NOT app_is_platform_scope() THEN
          RAISE EXCEPTION 'read state and mute are personal' USING ERRCODE = 'insufficient_privilege';
        END IF;
        RETURN NEW;
      END $$`);
    await q(`CREATE TRIGGER trg_chat_member_guard BEFORE UPDATE ON chat_member FOR EACH ROW EXECUTE FUNCTION chat_member_guard()`);
    await q(`
      CREATE FUNCTION chat_message_guard() RETURNS trigger LANGUAGE plpgsql AS $$
      DECLARE parent chat_message%ROWTYPE;
      BEGIN
        IF TG_OP = 'UPDATE' THEN
          IF NEW.channel_id <> OLD.channel_id OR NEW.workspace_id <> OLD.workspace_id OR NEW.author_id IS DISTINCT FROM OLD.author_id
             OR NEW.parent_id IS DISTINCT FROM OLD.parent_id OR NEW.kind <> OLD.kind OR NEW.task_id IS DISTINCT FROM OLD.task_id
             OR NEW.created_at <> OLD.created_at THEN
            RAISE EXCEPTION 'only the body of a chat message can change' USING ERRCODE = 'check_violation';
          END IF;
          IF OLD.deleted_at IS NOT NULL THEN
            RAISE EXCEPTION 'a deleted message cannot change' USING ERRCODE = 'check_violation';
          END IF;
          RETURN NEW;
        END IF;
        IF NEW.parent_id IS NOT NULL THEN
          SELECT * INTO parent FROM chat_message WHERE id = NEW.parent_id;
          IF NOT FOUND OR parent.channel_id <> NEW.channel_id OR parent.parent_id IS NOT NULL THEN
            RAISE EXCEPTION 'a reply must belong to a message at the top of the same channel' USING ERRCODE = 'check_violation';
          END IF;
        END IF;
        IF NEW.workspace_id <> (SELECT workspace_id FROM chat_channel WHERE id = NEW.channel_id) THEN
          RAISE EXCEPTION 'message and channel must share a workspace' USING ERRCODE = 'check_violation';
        END IF;
        RETURN NEW;
      END $$`);
    await q(`CREATE TRIGGER trg_chat_message_guard BEFORE INSERT OR UPDATE ON chat_message FOR EACH ROW EXECUTE FUNCTION chat_message_guard()`);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS chat_message`);
    await queryRunner.query(`DROP TABLE IF EXISTS chat_member`);
    await queryRunner.query(`DROP TABLE IF EXISTS chat_channel`);
    await queryRunner.query(`DROP FUNCTION IF EXISTS chat_message_guard()`);
    await queryRunner.query(`DROP FUNCTION IF EXISTS chat_member_guard()`);
    await queryRunner.query(`DROP FUNCTION IF EXISTS app_can_post_chat(uuid)`);
    await queryRunner.query(`DROP FUNCTION IF EXISTS app_can_read_chat_channel(uuid)`);
    await queryRunner.query(`DROP FUNCTION IF EXISTS app_chat_has_members(uuid)`);
    await queryRunner.query(`DROP FUNCTION IF EXISTS app_chat_role(uuid)`);
  }
}
