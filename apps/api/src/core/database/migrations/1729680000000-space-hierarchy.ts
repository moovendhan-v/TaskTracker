import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Nesting inside a project: folders (which may hold other folders) group a
 * space's lists, and spaces, folders, lists and docs can carry an icon key.
 * Deleting a folder moves what it holds up a level (the service does that
 * first); the foreign keys only fall back to "directly under the space".
 */
export class SpaceHierarchy1729680000000 implements MigrationInterface {
  name = 'SpaceHierarchy1729680000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    const q = (sql: string) => queryRunner.query(sql);
    const iconCheck = (column: string) => `CHECK (${column} IS NULL OR ${column} ~ '^[a-z0-9-]{1,32}$')`;

    await q(`
      CREATE TABLE list_folder (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        workspace_id uuid NOT NULL REFERENCES workspace(id) ON DELETE CASCADE,
        space_id uuid NOT NULL REFERENCES space(id) ON DELETE CASCADE,
        parent_id uuid REFERENCES list_folder(id) ON DELETE SET NULL,
        name varchar(80) NOT NULL,
        color varchar(7) CHECK (color IS NULL OR color ~ '^#[0-9a-fA-F]{6}$'),
        icon varchar(32) ${iconCheck('icon')},
        position double precision NOT NULL DEFAULT 0,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT chk_list_folder_parent CHECK (parent_id IS NULL OR parent_id <> id)
      )`);
    await q(`CREATE INDEX idx_list_folder_space ON list_folder (workspace_id, space_id)`);
    await q(`ALTER TABLE list_folder ENABLE ROW LEVEL SECURITY`);
    await q(`ALTER TABLE list_folder FORCE ROW LEVEL SECURITY`);
    await q(`
      CREATE POLICY tenant_isolation ON list_folder
      USING (app_can_access_workspace(workspace_id))
      WITH CHECK (app_can_access_workspace(workspace_id))`);

    await q(`ALTER TABLE task_list ADD COLUMN folder_id uuid REFERENCES list_folder(id) ON DELETE SET NULL`);
    await q(`ALTER TABLE task_list ADD COLUMN color varchar(7) CHECK (color IS NULL OR color ~ '^#[0-9a-fA-F]{6}$')`);
    await q(`ALTER TABLE task_list ADD COLUMN icon varchar(32) ${iconCheck('icon')}`);
    await q(`ALTER TABLE task_list ADD COLUMN position double precision NOT NULL DEFAULT 0`);
    // Keep today's order (oldest first) as the starting positions.
    await q(`
      UPDATE task_list SET position = ranked.n FROM (
        SELECT id, row_number() OVER (PARTITION BY space_id ORDER BY created_at) AS n FROM task_list
      ) ranked WHERE ranked.id = task_list.id`);
    await q(`CREATE INDEX idx_task_list_folder ON task_list (folder_id) WHERE folder_id IS NOT NULL`);

    await q(`ALTER TABLE space ADD COLUMN icon varchar(32) ${iconCheck('icon')}`);
    await q(`ALTER TABLE document ADD COLUMN icon varchar(32) ${iconCheck('icon')}`);
    await q(`CREATE INDEX idx_document_space ON document (workspace_id, space_id) WHERE space_id IS NOT NULL`);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    const q = (sql: string) => queryRunner.query(sql);
    await q(`DROP INDEX IF EXISTS idx_document_space`);
    await q(`ALTER TABLE document DROP COLUMN icon`);
    await q(`ALTER TABLE space DROP COLUMN icon`);
    await q(`ALTER TABLE task_list DROP COLUMN position`);
    await q(`ALTER TABLE task_list DROP COLUMN icon`);
    await q(`ALTER TABLE task_list DROP COLUMN color`);
    await q(`ALTER TABLE task_list DROP COLUMN folder_id`);
    await q(`DROP TABLE list_folder`);
  }
}
