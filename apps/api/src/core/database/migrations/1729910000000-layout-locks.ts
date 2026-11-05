import type { MigrationInterface, QueryRunner } from 'typeorm';

/** B4: a workspace default layout can be locked; the existing RLS covers the column. */
export class LayoutLocks1729910000000 implements MigrationInterface {
  name = 'LayoutLocks1729910000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE layout_default ADD COLUMN locked boolean NOT NULL DEFAULT false`);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE layout_default DROP COLUMN locked`);
  }
}
