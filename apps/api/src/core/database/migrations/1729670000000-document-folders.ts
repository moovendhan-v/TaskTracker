import type { MigrationInterface, QueryRunner } from 'typeorm';

/** Docs can be folders: a folder holds pages and other folders and has no content of its own. */
export class DocumentFolders1729670000000 implements MigrationInterface {
  name = 'DocumentFolders1729670000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE document ADD COLUMN kind varchar(10) NOT NULL DEFAULT 'page' CHECK (kind IN ('page', 'folder'))`);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE document DROP COLUMN kind`);
  }
}
