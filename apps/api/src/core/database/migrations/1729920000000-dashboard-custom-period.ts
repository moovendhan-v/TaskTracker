import type { MigrationInterface, QueryRunner } from 'typeorm';

/** C4: a named dashboard can also open with a custom range of days (`custom:2026-10-01..2026-10-31`). */
export class DashboardCustomPeriod1729920000000 implements MigrationInterface {
  name = 'DashboardCustomPeriod1729920000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE dashboard DROP CONSTRAINT chk_dashboard_period`);
    // The shape only; the API checks the days are real, in order and at most a year apart.
    await queryRunner.query(
      `ALTER TABLE dashboard ADD CONSTRAINT chk_dashboard_period CHECK (period IS NULL OR period IN ('this_week', 'last_week', 'this_month', 'last_month', 'last_30', 'this_year') OR period ~ '^custom:[0-9]{4}-[0-9]{2}-[0-9]{2}\\.\\.[0-9]{4}-[0-9]{2}-[0-9]{2}$')`,
    );
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`UPDATE dashboard SET period = NULL WHERE period LIKE 'custom:%'`);
    await queryRunner.query(`ALTER TABLE dashboard DROP CONSTRAINT chk_dashboard_period`);
    await queryRunner.query(
      `ALTER TABLE dashboard ADD CONSTRAINT chk_dashboard_period CHECK (period IS NULL OR period IN ('this_week', 'last_week', 'this_month', 'last_month', 'last_30', 'this_year'))`,
    );
  }
}
