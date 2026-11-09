import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * D2: calls (huddles) in chat channels, on a LiveKit media server. See docs/plan/D2_CALLS.md.
 *
 * A call is readable with its channel, like the channel's messages. Calls are started by
 * people who can post in the channel (joinCall); who is in a call and when it ends come
 * from LiveKit's verified webhooks.
 */
export class Calls1730000000000 implements MigrationInterface {
  name = 'Calls1730000000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    const q = (sql: string) => queryRunner.query(sql);
    await q(`
      CREATE TABLE call_session (
        id uuid PRIMARY KEY,
        workspace_id uuid NOT NULL REFERENCES workspace(id) ON DELETE CASCADE,
        channel_id uuid NOT NULL REFERENCES chat_channel(id) ON DELETE CASCADE,
        room text NOT NULL UNIQUE,
        started_by text NOT NULL REFERENCES "user"(id),
        started_at timestamptz NOT NULL DEFAULT now(),
        ended_at timestamptz,
        peak_participants integer NOT NULL DEFAULT 0,
        message_id uuid REFERENCES chat_message(id) ON DELETE SET NULL,
        CONSTRAINT chk_call_session_room CHECK (room ~ '^tf-[0-9a-f-]{36}$')
      )`);
    // One call at a time per channel.
    await q(`CREATE UNIQUE INDEX uq_call_session_active_channel ON call_session (channel_id) WHERE ended_at IS NULL`);
    await q(`CREATE INDEX idx_call_session_workspace_active ON call_session (workspace_id) WHERE ended_at IS NULL`);
    await q(`
      CREATE TABLE call_participant (
        session_id uuid NOT NULL REFERENCES call_session(id) ON DELETE CASCADE,
        workspace_id uuid NOT NULL REFERENCES workspace(id) ON DELETE CASCADE,
        channel_id uuid NOT NULL REFERENCES chat_channel(id) ON DELETE CASCADE,
        user_id text NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
        joined_at timestamptz NOT NULL DEFAULT now(),
        left_at timestamptz,
        PRIMARY KEY (session_id, user_id)
      )`);
    await q(`
      CREATE TABLE livekit_webhook_event (
        id text PRIMARY KEY,
        received_at timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT chk_livekit_webhook_event_id CHECK (length(id) BETWEEN 1 AND 200)
      )`);

    for (const table of ['call_session', 'call_participant', 'livekit_webhook_event']) {
      await q(`ALTER TABLE ${table} ENABLE ROW LEVEL SECURITY`);
      await q(`ALTER TABLE ${table} FORCE ROW LEVEL SECURITY`);
    }
    for (const table of ['call_session', 'call_participant']) {
      // Read with the channel, like its messages.
      await q(`
        CREATE POLICY ${table}_read ON ${table} FOR SELECT
        USING (app_can_access_workspace(workspace_id) AND (app_is_platform_scope() OR app_can_read_chat_channel(channel_id)))`);
      await q(`CREATE POLICY ${table}_insert ON ${table} FOR INSERT WITH CHECK (app_can_access_workspace(workspace_id))`);
      await q(`CREATE POLICY ${table}_update ON ${table} FOR UPDATE USING (app_can_access_workspace(workspace_id)) WITH CHECK (app_can_access_workspace(workspace_id))`);
    }
    // A call is started only by someone who can post in its channel, as themselves.
    await q(`DROP POLICY call_session_insert ON call_session`);
    await q(`
      CREATE POLICY call_session_insert ON call_session FOR INSERT
      WITH CHECK (app_can_access_workspace(workspace_id) AND (app_is_platform_scope() OR (started_by = app_current_user_id() AND app_can_post_chat(channel_id))))`);
    // Webhook bookkeeping only exists in the platform scope.
    await q(`CREATE POLICY livekit_webhook_event_platform ON livekit_webhook_event USING (app_is_platform_scope()) WITH CHECK (app_is_platform_scope())`);

    // A participant row belongs to its session's channel.
    await q(`
      CREATE FUNCTION call_participant_guard() RETURNS trigger LANGUAGE plpgsql AS $$
      BEGIN
        IF NOT EXISTS (SELECT 1 FROM call_session s WHERE s.id = NEW.session_id AND s.channel_id = NEW.channel_id AND s.workspace_id = NEW.workspace_id) THEN
          RAISE EXCEPTION 'a call participant must match its call' USING ERRCODE = 'check_violation';
        END IF;
        RETURN NEW;
      END $$`);
    await q(`CREATE TRIGGER trg_call_participant_guard BEFORE INSERT OR UPDATE ON call_participant FOR EACH ROW EXECUTE FUNCTION call_participant_guard()`);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    const q = (sql: string) => queryRunner.query(sql);
    await q(`DROP TABLE IF EXISTS livekit_webhook_event`);
    await q(`DROP TABLE IF EXISTS call_participant`);
    await q(`DROP TABLE IF EXISTS call_session`);
    await q(`DROP FUNCTION IF EXISTS call_participant_guard()`);
  }
}
