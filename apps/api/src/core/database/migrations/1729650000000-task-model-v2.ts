import type { MigrationInterface, QueryRunner } from 'typeorm';

const TENANT_TABLES = ['task_status', 'task_watcher', 'task_relation', 'custom_field', 'task_activity'];

/**
 * Tasks grow up:
 * - custom statuses per space, each with a category that drives "closed";
 * - a short number per workspace (#978), a type, subtasks, start dates,
 *   estimates, progress, custom field values and completion time;
 * - watchers, relations (relates, blocks, duplicates) and an activity history;
 * - custom fields for tasks and spaces, and project status on spaces.
 */
export class TaskModelV21729650000000 implements MigrationInterface {
  name = 'TaskModelV21729650000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    const q = (sql: string) => queryRunner.query(sql);

    // Statuses, seeded for every existing space and mapped from the old fixed values.
    await q(`
      CREATE TABLE task_status (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        workspace_id uuid NOT NULL REFERENCES workspace(id) ON DELETE CASCADE,
        space_id uuid NOT NULL REFERENCES space(id) ON DELETE CASCADE,
        name varchar(40) NOT NULL,
        color varchar(9) NOT NULL,
        category varchar(12) NOT NULL CHECK (category IN ('unstarted', 'started', 'review', 'blocked', 'done', 'cancelled')),
        position integer NOT NULL,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now()
      )`);
    await q(`CREATE UNIQUE INDEX uq_task_status_name ON task_status (space_id, lower(name))`);
    await q(`CREATE INDEX idx_task_status_space ON task_status (workspace_id, space_id, position)`);
    await q(`
      INSERT INTO task_status (workspace_id, space_id, name, color, category, position)
      SELECT space.workspace_id, space.id, s.name, s.color, s.category, s.position
      FROM space CROSS JOIN (VALUES
        ('To do', '#0891b2', 'unstarted', 1),
        ('In progress', '#c026d3', 'started', 2),
        ('In review', '#0ea5e9', 'review', 3),
        ('Blocked', '#dc2626', 'blocked', 4),
        ('Done', '#16a34a', 'done', 5)
      ) AS s(name, color, category, position)`);

    await q(`ALTER TABLE task ADD COLUMN status_id uuid REFERENCES task_status(id) ON DELETE RESTRICT`);
    await q(`
      UPDATE task SET status_id = status.id
      FROM task_list list, task_status status
      WHERE list.id = task.list_id AND status.space_id = list.space_id
        AND status.name = CASE task.status WHEN 'todo' THEN 'To do' WHEN 'in_progress' THEN 'In progress' WHEN 'in_review' THEN 'In review' ELSE 'Done' END`);
    await q(`ALTER TABLE task ALTER COLUMN status_id SET NOT NULL`);

    await q(`ALTER TABLE task ADD COLUMN completed_at timestamptz`);
    await q(`UPDATE task SET completed_at = updated_at WHERE status = 'done'`);
    await q(`ALTER TABLE task DROP COLUMN status`);
    await q(`CREATE INDEX idx_task_list_status ON task (workspace_id, list_id, status_id, position)`);

    // Numbers: #1, #2… per workspace, in creation order.
    await q(`ALTER TABLE workspace ADD COLUMN next_task_number integer NOT NULL DEFAULT 1`);
    await q(`ALTER TABLE task ADD COLUMN number integer`);
    await q(`
      UPDATE task SET number = numbered.n
      FROM (SELECT id, row_number() OVER (PARTITION BY workspace_id ORDER BY created_at, id) AS n FROM task) numbered
      WHERE numbered.id = task.id`);
    await q(`UPDATE workspace SET next_task_number = COALESCE((SELECT max(number) FROM task WHERE task.workspace_id = workspace.id), 0) + 1`);
    await q(`ALTER TABLE task ALTER COLUMN number SET NOT NULL`);
    await q(`CREATE UNIQUE INDEX uq_task_number ON task (workspace_id, number)`);

    await q(`ALTER TABLE task ADD COLUMN type varchar(12) NOT NULL DEFAULT 'task' CHECK (type IN ('task', 'bug', 'feature', 'phase', 'milestone'))`);
    await q(`ALTER TABLE task ADD COLUMN parent_id uuid REFERENCES task(id) ON DELETE CASCADE`);
    await q(`CREATE INDEX idx_task_parent ON task (workspace_id, parent_id) WHERE parent_id IS NOT NULL`);
    await q(`ALTER TABLE task ADD CONSTRAINT chk_task_not_own_parent CHECK (parent_id IS NULL OR parent_id <> id)`);
    await q(`ALTER TABLE task ADD COLUMN start_date timestamptz`);
    await q(`ALTER TABLE task ADD CONSTRAINT chk_task_dates CHECK (start_date IS NULL OR due_date IS NULL OR start_date <= due_date)`);
    await q(`ALTER TABLE task ADD COLUMN estimate_minutes integer CHECK (estimate_minutes BETWEEN 0 AND 100000)`);
    await q(`ALTER TABLE task ADD COLUMN progress smallint CHECK (progress BETWEEN 0 AND 100)`);
    await q(`ALTER TABLE task ADD COLUMN custom_fields jsonb NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(custom_fields) = 'object')`);
    await q(`CREATE INDEX idx_task_due ON task (workspace_id, due_date) WHERE due_date IS NOT NULL`);
    await q(`CREATE INDEX idx_task_assignee ON task (workspace_id, assignee_id)`);

    await q(`
      CREATE TABLE task_watcher (
        workspace_id uuid NOT NULL REFERENCES workspace(id) ON DELETE CASCADE,
        task_id uuid NOT NULL REFERENCES task(id) ON DELETE CASCADE,
        user_id text NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
        created_at timestamptz NOT NULL DEFAULT now(),
        PRIMARY KEY (task_id, user_id)
      )`);
    await q(`CREATE INDEX idx_task_watcher_user ON task_watcher (workspace_id, user_id)`);

    await q(`
      CREATE TABLE task_relation (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        workspace_id uuid NOT NULL REFERENCES workspace(id) ON DELETE CASCADE,
        task_id uuid NOT NULL REFERENCES task(id) ON DELETE CASCADE,
        related_task_id uuid NOT NULL REFERENCES task(id) ON DELETE CASCADE,
        kind varchar(12) NOT NULL CHECK (kind IN ('relates', 'blocks', 'duplicates')),
        created_by_id text REFERENCES "user"(id) ON DELETE SET NULL,
        created_at timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT chk_task_relation_self CHECK (task_id <> related_task_id),
        CONSTRAINT uq_task_relation UNIQUE (task_id, related_task_id, kind)
      )`);
    await q(`CREATE INDEX idx_task_relation_related ON task_relation (related_task_id)`);

    await q(`
      CREATE TABLE custom_field (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        workspace_id uuid NOT NULL REFERENCES workspace(id) ON DELETE CASCADE,
        space_id uuid REFERENCES space(id) ON DELETE CASCADE,
        entity varchar(10) NOT NULL DEFAULT 'task' CHECK (entity IN ('task', 'space')),
        name varchar(60) NOT NULL,
        type varchar(16) NOT NULL CHECK (type IN ('text', 'number', 'money', 'date', 'checkbox', 'select', 'multi_select', 'url', 'email', 'user')),
        options jsonb NOT NULL DEFAULT '[]'::jsonb CHECK (jsonb_typeof(options) = 'array'),
        required boolean NOT NULL DEFAULT false,
        position integer NOT NULL DEFAULT 0,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now()
      )`);
    await q(`CREATE UNIQUE INDEX uq_custom_field_name ON custom_field (workspace_id, entity, COALESCE(space_id, '00000000-0000-0000-0000-000000000000'::uuid), lower(name))`);

    await q(`
      CREATE TABLE task_activity (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        workspace_id uuid NOT NULL REFERENCES workspace(id) ON DELETE CASCADE,
        task_id uuid NOT NULL REFERENCES task(id) ON DELETE CASCADE,
        actor_id text REFERENCES "user"(id) ON DELETE SET NULL,
        kind varchar(30) NOT NULL,
        field varchar(40),
        from_value varchar(300),
        to_value varchar(300),
        created_at timestamptz NOT NULL DEFAULT now()
      )`);
    await q(`CREATE INDEX idx_task_activity_task ON task_activity (workspace_id, task_id, created_at DESC)`);

    await q(`ALTER TABLE space ADD COLUMN status varchar(12) NOT NULL DEFAULT 'on_track' CHECK (status IN ('on_track', 'at_risk', 'off_track', 'on_hold', 'complete'))`);
    await q(`ALTER TABLE space ADD COLUMN status_note varchar(500) NOT NULL DEFAULT ''`);
    await q(`ALTER TABLE space ADD COLUMN start_date date`);
    await q(`ALTER TABLE space ADD COLUMN due_date date`);
    await q(`ALTER TABLE space ADD COLUMN custom_fields jsonb NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(custom_fields) = 'object')`);

    for (const table of TENANT_TABLES) {
      await q(`ALTER TABLE ${table} ENABLE ROW LEVEL SECURITY`);
      await q(`ALTER TABLE ${table} FORCE ROW LEVEL SECURITY`);
      await q(`
        CREATE POLICY tenant_isolation ON ${table}
        USING (app_can_access_workspace(workspace_id))
        WITH CHECK (app_can_access_workspace(workspace_id))`);
    }
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    const q = (sql: string) => queryRunner.query(sql);
    for (const table of ['task_activity', 'custom_field', 'task_relation', 'task_watcher']) await q(`DROP TABLE ${table}`);
    for (const column of ['status', 'status_note', 'start_date', 'due_date', 'custom_fields']) await q(`ALTER TABLE space DROP COLUMN ${column}`);
    await q(`ALTER TABLE task ADD COLUMN status varchar(20) NOT NULL DEFAULT 'todo'`);
    await q(`
      UPDATE task SET status = CASE status.category WHEN 'done' THEN 'done' WHEN 'cancelled' THEN 'done' WHEN 'review' THEN 'in_review'
        WHEN 'unstarted' THEN 'todo' ELSE 'in_progress' END
      FROM task_status status WHERE status.id = task.status_id`);
    await q(`DROP INDEX IF EXISTS idx_task_list_status`);
    for (const column of ['status_id', 'completed_at', 'number', 'type', 'parent_id', 'start_date', 'estimate_minutes', 'progress', 'custom_fields']) {
      await q(`ALTER TABLE task DROP COLUMN ${column}`);
    }
    await q(`ALTER TABLE workspace DROP COLUMN next_task_number`);
    await q(`DROP TABLE task_status`);
  }
}
