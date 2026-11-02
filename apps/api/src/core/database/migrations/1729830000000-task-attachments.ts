import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Files on tasks. The bytes live in private storage under a server-made key; this
 * row says who may see them. A file follows its task's visibility (workspace and
 * per-space limits, like the task's other child rows); while it's still being
 * uploaded only its uploader sees it. Only the uploader changes it.
 */
export class TaskAttachments1729830000000 implements MigrationInterface {
  name = 'TaskAttachments1729830000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    const q = (sql: string) => queryRunner.query(sql);
    await q(`
      CREATE TABLE task_attachment (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        workspace_id uuid NOT NULL REFERENCES workspace(id) ON DELETE CASCADE,
        task_id uuid NOT NULL REFERENCES task(id) ON DELETE CASCADE,
        uploader_id text REFERENCES "user"(id) ON DELETE SET NULL,
        file_name text NOT NULL,
        content_type text,
        declared_size bigint NOT NULL,
        size bigint,
        storage_key text NOT NULL UNIQUE,
        status text NOT NULL DEFAULT 'pending',
        created_at timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT chk_task_attachment_status CHECK (status IN ('pending', 'ready')),
        CONSTRAINT chk_task_attachment_name CHECK (length(file_name) BETWEEN 1 AND 200),
        CONSTRAINT chk_task_attachment_size CHECK (declared_size > 0 AND (size IS NULL OR size > 0)),
        CONSTRAINT chk_task_attachment_ready CHECK (status = 'pending' OR (content_type IS NOT NULL AND size IS NOT NULL))
      )`);
    await q(`CREATE INDEX idx_task_attachment_task ON task_attachment (workspace_id, task_id, created_at)`);
    await q(`CREATE INDEX idx_task_attachment_pending ON task_attachment (uploader_id, created_at) WHERE status = 'pending'`);
    await q(`ALTER TABLE task_attachment ENABLE ROW LEVEL SECURITY`);
    await q(`ALTER TABLE task_attachment FORCE ROW LEVEL SECURITY`);
    // Tenant, then (restrictive) the task's own visibility, as for comments and the task's other children.
    await q(`
      CREATE POLICY tenant_isolation ON task_attachment
      USING (app_can_access_workspace(workspace_id)) WITH CHECK (app_can_access_workspace(workspace_id))`);
    await q(`
      CREATE POLICY space_access ON task_attachment AS RESTRICTIVE
      USING (app_task_spaces_unlimited() OR EXISTS (SELECT 1 FROM task WHERE task.id = task_attachment.task_id))
      WITH CHECK (app_task_spaces_unlimited() OR EXISTS (SELECT 1 FROM task WHERE task.id = task_attachment.task_id))`);
    await q(`
      CREATE POLICY pending_own ON task_attachment AS RESTRICTIVE FOR SELECT
      USING (app_is_platform_scope() OR status = 'ready' OR uploader_id = app_current_user_id())`);
    await q(`
      CREATE POLICY uploader_insert ON task_attachment AS RESTRICTIVE FOR INSERT
      WITH CHECK (uploader_id = app_current_user_id() AND status = 'pending')`);
    await q(`
      CREATE POLICY uploader_update ON task_attachment AS RESTRICTIVE FOR UPDATE
      USING (uploader_id = app_current_user_id()) WITH CHECK (uploader_id = app_current_user_id())`);
    await q(`
      CREATE FUNCTION task_attachment_guard() RETURNS trigger LANGUAGE plpgsql AS $$
      BEGIN
        IF NEW.workspace_id <> OLD.workspace_id OR NEW.task_id <> OLD.task_id OR NEW.uploader_id IS DISTINCT FROM OLD.uploader_id
           OR NEW.storage_key <> OLD.storage_key OR NEW.file_name <> OLD.file_name OR NEW.declared_size <> OLD.declared_size THEN
          RAISE EXCEPTION 'an attachment can only be checked' USING ERRCODE = 'check_violation';
        END IF;
        RETURN NEW;
      END $$`);
    await q(`CREATE TRIGGER trg_task_attachment_guard BEFORE UPDATE ON task_attachment FOR EACH ROW EXECUTE FUNCTION task_attachment_guard()`);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS task_attachment`);
    await queryRunner.query(`DROP FUNCTION IF EXISTS task_attachment_guard()`);
  }
}
