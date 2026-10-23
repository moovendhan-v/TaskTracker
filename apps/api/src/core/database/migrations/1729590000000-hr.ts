import type { MigrationInterface, QueryRunner } from 'typeorm';

export class Hr1729590000000 implements MigrationInterface {
  name = 'Hr1729590000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE department (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        workspace_id uuid NOT NULL REFERENCES workspace(id) ON DELETE CASCADE,
        name varchar(80) NOT NULL,
        head_user_id text REFERENCES "user"(id) ON DELETE SET NULL,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT uq_department_name UNIQUE (workspace_id, name)
      )`);

    await queryRunner.query(`
      CREATE TABLE employee_profile (
        workspace_id uuid NOT NULL REFERENCES workspace(id) ON DELETE CASCADE,
        user_id text NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
        job_title varchar(100),
        department_id uuid REFERENCES department(id) ON DELETE SET NULL,
        manager_user_id text REFERENCES "user"(id) ON DELETE SET NULL,
        employment_type varchar(20) CHECK (employment_type IN ('full_time', 'part_time', 'contractor', 'intern')),
        start_date date,
        updated_at timestamptz NOT NULL DEFAULT now(),
        PRIMARY KEY (workspace_id, user_id),
        CONSTRAINT chk_profile_not_own_manager CHECK (manager_user_id IS NULL OR manager_user_id <> user_id)
      )`);

    await queryRunner.query(`
      CREATE TABLE leave_type (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        workspace_id uuid NOT NULL REFERENCES workspace(id) ON DELETE CASCADE,
        name varchar(80) NOT NULL,
        color varchar(7) NOT NULL,
        annual_allowance_days integer CHECK (annual_allowance_days IS NULL OR annual_allowance_days BETWEEN 0 AND 365),
        requires_approval boolean NOT NULL DEFAULT true,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT uq_leave_type_name UNIQUE (workspace_id, name)
      )`);

    await queryRunner.query(`
      CREATE TABLE leave_request (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        workspace_id uuid NOT NULL REFERENCES workspace(id) ON DELETE CASCADE,
        user_id text NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
        leave_type_id uuid NOT NULL REFERENCES leave_type(id) ON DELETE RESTRICT,
        start_date date NOT NULL,
        end_date date NOT NULL,
        days integer NOT NULL CHECK (days > 0),
        reason varchar(1000) NOT NULL DEFAULT '',
        status varchar(12) NOT NULL CHECK (status IN ('pending', 'approved', 'rejected', 'cancelled')),
        decided_by_id text REFERENCES "user"(id) ON DELETE SET NULL,
        decided_at timestamptz,
        decision_note varchar(1000) NOT NULL DEFAULT '',
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT chk_leave_dates CHECK (end_date >= start_date),
        CONSTRAINT chk_leave_not_self_decided CHECK (decided_by_id IS NULL OR decided_by_id <> user_id)
      )`);
    await queryRunner.query(`CREATE INDEX idx_leave_request_user_start ON leave_request (workspace_id, user_id, start_date)`);
    await queryRunner.query(`CREATE INDEX idx_leave_request_status_created ON leave_request (workspace_id, status, created_at)`);

    await queryRunner.query(`
      CREATE TABLE leave_balance (
        workspace_id uuid NOT NULL REFERENCES workspace(id) ON DELETE CASCADE,
        user_id text NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
        leave_type_id uuid NOT NULL REFERENCES leave_type(id) ON DELETE CASCADE,
        year integer NOT NULL,
        used_days integer NOT NULL DEFAULT 0 CHECK (used_days >= 0),
        updated_at timestamptz NOT NULL DEFAULT now(),
        PRIMARY KEY (workspace_id, user_id, leave_type_id, year)
      )`);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS leave_balance`);
    await queryRunner.query(`DROP TABLE IF EXISTS leave_request`);
    await queryRunner.query(`DROP TABLE IF EXISTS leave_type`);
    await queryRunner.query(`DROP TABLE IF EXISTS employee_profile`);
    await queryRunner.query(`DROP TABLE IF EXISTS department`);
  }
}
