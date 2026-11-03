import type { MigrationInterface, QueryRunner } from 'typeorm';

/** C4: a named dashboard remembers the date range it opens with. The table's RLS covers the new column. */
export class DashboardPeriod1729860000000 implements MigrationInterface {
  name = 'DashboardPeriod1729860000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE dashboard ADD COLUMN period text`);
    await queryRunner.query(
      `ALTER TABLE dashboard ADD CONSTRAINT chk_dashboard_period CHECK (period IS NULL OR period IN ('this_week', 'last_week', 'this_month', 'last_month', 'last_30', 'this_year'))`,
    );
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE dashboard DROP COLUMN period`);
  }
}
