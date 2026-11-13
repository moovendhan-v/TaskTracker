import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * E4 attendance corrections: HR (hr.manage) can fix a shift someone forgot to
 * clock out of, or clocked at the wrong time. The shift remembers who corrected
 * it, when and why; the audit log keeps the times before and after.
 *
 * RLS is unchanged: people still only write their own shifts. The service checks
 * hr.manage, then makes the one correction in platform scope with the workspace
 * named in the statement.
 */
export class AttendanceCorrections1730090000000 implements MigrationInterface {
  name = 'AttendanceCorrections1730090000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE attendance_shift
        ADD COLUMN corrected_by_id text REFERENCES "user"(id) ON DELETE SET NULL,
        ADD COLUMN corrected_at timestamptz,
        ADD COLUMN correction_reason varchar(300),
        ADD CONSTRAINT chk_attendance_correction CHECK ((corrected_at IS NULL) = (correction_reason IS NULL))`);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE attendance_shift
        DROP CONSTRAINT chk_attendance_correction,
        DROP COLUMN correction_reason,
        DROP COLUMN corrected_at,
        DROP COLUMN corrected_by_id`);
  }
}
