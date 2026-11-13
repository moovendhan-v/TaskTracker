import type { MigrationInterface, QueryRunner } from 'typeorm';

/** C2: a task's checklist. Steps follow their task's visibility, like comments and files. */
export class TaskChecklists1730060000000 implements MigrationInterface {
  name = 'TaskChecklists1730060000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    const q = (sql: string) => queryRunner.query(sql);
    await q(`
      CREATE TABLE task_checklist_item (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        workspace_id uuid NOT NULL REFERENCES workspace(id) ON DELETE CASCADE,
        task_id uuid NOT NULL REFERENCES task(id) ON DELETE CASCADE,
        title varchar(300) NOT NULL CHECK (length(btrim(title)) > 0),
        done boolean NOT NULL DEFAULT false,
        done_at timestamptz,
        done_by text REFERENCES "user"(id) ON DELETE SET NULL,
        position double precision NOT NULL,
        created_by text REFERENCES "user"(id) ON DELETE SET NULL,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT chk_task_checklist_done CHECK (done = (done_at IS NOT NULL))
      )`);
    await q(`CREATE INDEX idx_task_checklist_task ON task_checklist_item (workspace_id, task_id, position)`);
    await q(`ALTER TABLE task_checklist_item ENABLE ROW LEVEL SECURITY`);
    await q(`ALTER TABLE task_checklist_item FORCE ROW LEVEL SECURITY`);
    await q(`
      CREATE POLICY tenant_isolation ON task_checklist_item
      USING (app_can_access_workspace(workspace_id)) WITH CHECK (app_can_access_workspace(workspace_id))`);
    await q(`
      CREATE POLICY space_access ON task_checklist_item AS RESTRICTIVE
      USING (app_task_spaces_unlimited() OR EXISTS (SELECT 1 FROM task WHERE task.id = task_checklist_item.task_id))
      WITH CHECK (app_task_spaces_unlimited() OR EXISTS (SELECT 1 FROM task WHERE task.id = task_checklist_item.task_id))`);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE task_checklist_item`);
  }
}
