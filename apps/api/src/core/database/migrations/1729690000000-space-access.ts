import type { MigrationInterface, QueryRunner } from 'typeorm';

/** Tables whose rows sit in one space through a `space_id` column, hidden with that space. */
const SPACE_TABLES = ['task_list', 'list_folder', 'sprint', 'task_status', 'task', 'custom_field', 'time_entry'] as const;

/** Tables whose rows hang off a task: hidden when their task is. */
const TASK_CHILD_TABLES = ['task_comment', 'task_activity', 'task_watcher', 'task_relation'] as const;

/**
 * Space-level access (IAM statements limited to spaces). The API puts the
 * caller's space limits into transaction-local settings next to the workspace
 * scope (see core/database/data-scope.ts):
 *
 *   app.space_task_deny  ids where task.view is denied
 *   app.space_task_only  ids that are the only ones allowed ('*' no limit, '-' none)
 *   app.space_doc_deny / app.space_doc_only  the same for doc.view
 *
 * RESTRICTIVE policies combine with the tenant policies (both must pass), so a
 * hidden space's rows can be neither read nor written, whatever the query.
 *
 * Tasks get a `space_id` that a trigger keeps equal to their list's space, so
 * the check needs no join. The trigger reads the list under the same policies:
 * a task can't be put into a list the caller can't see (space_id would be null).
 */
export class SpaceAccess1729690000000 implements MigrationInterface {
  name = 'SpaceAccess1729690000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    const q = (sql: string) => queryRunner.query(sql);

    await q(`
      CREATE FUNCTION app_space_visible(space uuid, deny_setting text, only_setting text) RETURNS boolean LANGUAGE sql STABLE AS $$
        SELECT space IS NULL OR (
          NOT (space::text = ANY (string_to_array(coalesce(current_setting(deny_setting, true), ''), ',')))
          AND (
            coalesce(nullif(current_setting(only_setting, true), ''), '*') = '*'
            OR space::text = ANY (string_to_array(current_setting(only_setting, true), ','))
          )
        )
      $$`);
    await q(`
      CREATE FUNCTION app_task_space_visible(space uuid) RETURNS boolean LANGUAGE sql STABLE AS $$
        SELECT app_space_visible(space, 'app.space_task_deny', 'app.space_task_only')
      $$`);
    await q(`
      CREATE FUNCTION app_doc_space_visible(space uuid) RETURNS boolean LANGUAGE sql STABLE AS $$
        SELECT app_space_visible(space, 'app.space_doc_deny', 'app.space_doc_only')
      $$`);
    // True when the caller has no task space limits, so child rows skip the lookup of their task.
    await q(`
      CREATE FUNCTION app_task_spaces_unlimited() RETURNS boolean LANGUAGE sql STABLE AS $$
        SELECT coalesce(current_setting('app.space_task_deny', true), '') = ''
          AND coalesce(nullif(current_setting('app.space_task_only', true), ''), '*') = '*'
      $$`);

    await q(`ALTER TABLE task ADD COLUMN space_id uuid REFERENCES space(id) ON DELETE CASCADE`);
    await q(`UPDATE task SET space_id = task_list.space_id FROM task_list WHERE task_list.id = task.list_id`);
    await q(`ALTER TABLE task ALTER COLUMN space_id SET NOT NULL`);
    await q(`CREATE INDEX idx_task_space ON task (workspace_id, space_id)`);
    await q(`
      CREATE FUNCTION task_set_space_id() RETURNS trigger LANGUAGE plpgsql AS $$
      BEGIN
        NEW.space_id := (SELECT space_id FROM task_list WHERE id = NEW.list_id AND workspace_id = NEW.workspace_id);
        RETURN NEW;
      END
      $$`);
    await q(`CREATE TRIGGER task_space_id BEFORE INSERT OR UPDATE OF list_id ON task FOR EACH ROW EXECUTE FUNCTION task_set_space_id()`);

    await q(`
      CREATE POLICY space_access ON space AS RESTRICTIVE
      USING (app_task_space_visible(id)) WITH CHECK (app_task_space_visible(id))`);
    for (const table of SPACE_TABLES) {
      await q(`
        CREATE POLICY space_access ON ${table} AS RESTRICTIVE
        USING (app_task_space_visible(space_id)) WITH CHECK (app_task_space_visible(space_id))`);
    }
    await q(`
      CREATE POLICY space_access ON document AS RESTRICTIVE
      USING (app_doc_space_visible(space_id)) WITH CHECK (app_doc_space_visible(space_id))`);
    for (const table of TASK_CHILD_TABLES) {
      await q(`
        CREATE POLICY space_access ON ${table} AS RESTRICTIVE
        USING (app_task_spaces_unlimited() OR EXISTS (SELECT 1 FROM task WHERE task.id = ${table}.task_id))
        WITH CHECK (app_task_spaces_unlimited() OR EXISTS (SELECT 1 FROM task WHERE task.id = ${table}.task_id))`);
    }
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    const q = (sql: string) => queryRunner.query(sql);
    for (const table of ['space', 'document', ...SPACE_TABLES, ...TASK_CHILD_TABLES]) await q(`DROP POLICY IF EXISTS space_access ON ${table}`);
    await q(`DROP TRIGGER IF EXISTS task_space_id ON task`);
    await q(`DROP FUNCTION IF EXISTS task_set_space_id()`);
    await q(`ALTER TABLE task DROP COLUMN space_id`);
    await q(`DROP FUNCTION IF EXISTS app_task_spaces_unlimited()`);
    await q(`DROP FUNCTION IF EXISTS app_doc_space_visible(uuid)`);
    await q(`DROP FUNCTION IF EXISTS app_task_space_visible(uuid)`);
    await q(`DROP FUNCTION IF EXISTS app_space_visible(uuid, text, text)`);
  }
}
