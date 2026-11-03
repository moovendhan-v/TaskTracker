import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * E4 attendance: one row per clocked shift, breaks inside it. Times come from
 * the server clock only.
 *
 * - One open shift per person and workspace (partial unique index), so two
 *   tabs or a double click can't clock someone in twice.
 * - RLS: tenant rows only; and only the person can add or change their own
 *   shifts. Reading the team's needs hr.manage, which the service checks.
 */
export class Attendance1729870000000 implements MigrationInterface {
  name = 'Attendance1729870000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    const q = (sql: string) => queryRunner.query(sql);
    await q(`
      CREATE TABLE attendance_shift (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        workspace_id uuid NOT NULL REFERENCES workspace(id) ON DELETE CASCADE,
        user_id text NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
        started_at timestamptz NOT NULL,
        ended_at timestamptz,
        breaks jsonb NOT NULL DEFAULT '[]'::jsonb,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT chk_attendance_order CHECK (ended_at IS NULL OR ended_at >= started_at),
        CONSTRAINT chk_attendance_breaks CHECK (jsonb_typeof(breaks) = 'array' AND jsonb_array_length(breaks) <= 10)
      )`);
    await q(`CREATE UNIQUE INDEX uq_attendance_open ON attendance_shift (workspace_id, user_id) WHERE ended_at IS NULL`);
    await q(`CREATE INDEX idx_attendance_range ON attendance_shift (workspace_id, started_at)`);
    await q(`CREATE INDEX idx_attendance_user ON attendance_shift (workspace_id, user_id, started_at DESC)`);

    await q(`ALTER TABLE attendance_shift ENABLE ROW LEVEL SECURITY`);
    await q(`ALTER TABLE attendance_shift FORCE ROW LEVEL SECURITY`);
    await q(`
      CREATE POLICY tenant_isolation ON attendance_shift
      USING (app_can_access_workspace(workspace_id))
      WITH CHECK (app_can_access_workspace(workspace_id))`);
    await q(`
      CREATE POLICY own_insert ON attendance_shift AS RESTRICTIVE FOR INSERT
      WITH CHECK (app_is_platform_scope() OR user_id = app_current_user_id())`);
    await q(`
      CREATE POLICY own_update ON attendance_shift AS RESTRICTIVE FOR UPDATE
      USING (app_is_platform_scope() OR user_id = app_current_user_id())
      WITH CHECK (app_is_platform_scope() OR user_id = app_current_user_id())`);
    await q(`
      CREATE POLICY own_delete ON attendance_shift AS RESTRICTIVE FOR DELETE
      USING (app_is_platform_scope() OR user_id = app_current_user_id())`);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE attendance_shift`);
  }
}
