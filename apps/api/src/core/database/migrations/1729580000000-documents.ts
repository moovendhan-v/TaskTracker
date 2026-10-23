import type { MigrationInterface, QueryRunner } from 'typeorm';

export class Documents1729580000000 implements MigrationInterface {
  name = 'Documents1729580000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE document (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        workspace_id uuid NOT NULL REFERENCES workspace(id) ON DELETE CASCADE,
        space_id uuid REFERENCES space(id) ON DELETE SET NULL,
        parent_id uuid REFERENCES document(id) ON DELETE CASCADE,
        title varchar(200) NOT NULL,
        content text NOT NULL DEFAULT '' CHECK (char_length(content) <= 100000),
        position double precision NOT NULL,
        created_by_id text NOT NULL REFERENCES "user"(id) ON DELETE RESTRICT,
        updated_by_id text NOT NULL REFERENCES "user"(id) ON DELETE RESTRICT,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT chk_document_not_own_parent CHECK (parent_id IS NULL OR parent_id <> id)
      )`);
    await queryRunner.query(`CREATE INDEX idx_document_workspace_parent_position ON document (workspace_id, parent_id, position)`);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS document`);
  }
}
