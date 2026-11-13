import type { MigrationInterface, QueryRunner } from 'typeorm';

/** Image uploads get a small preview stored next to them (`<storage key>-thumb`); this says whether one was made. */
export class UploadPreviews1730030000000 implements MigrationInterface {
  name = 'UploadPreviews1730030000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE chat_attachment ADD COLUMN has_thumbnail boolean NOT NULL DEFAULT false`);
    await queryRunner.query(`ALTER TABLE task_attachment ADD COLUMN has_thumbnail boolean NOT NULL DEFAULT false`);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE chat_attachment DROP COLUMN has_thumbnail`);
    await queryRunner.query(`ALTER TABLE task_attachment DROP COLUMN has_thumbnail`);
  }
}
