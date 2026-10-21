import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Core TaskFlow tables. Runs after Better Auth's own migrations, which create
 * the "user", "session", "account" and "verification" tables.
 */
export class InitialSchema1729550000000 implements MigrationInterface {
  name = 'InitialSchema1729550000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE workspace (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        name varchar(80) NOT NULL,
        color varchar(7) NOT NULL,
        owner_id text NOT NULL REFERENCES "user"(id) ON DELETE RESTRICT,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now()
      )`);

    await queryRunner.query(`
      CREATE TABLE workspace_role (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        workspace_id uuid NOT NULL REFERENCES workspace(id) ON DELETE CASCADE,
        name varchar(50) NOT NULL,
        system_key varchar(20),
        permissions text[] NOT NULL DEFAULT '{}',
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT uq_workspace_role_name UNIQUE (workspace_id, name),
        CONSTRAINT uq_workspace_role_system_key UNIQUE (workspace_id, system_key)
      )`);

    await queryRunner.query(`
      CREATE TABLE workspace_member (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        workspace_id uuid NOT NULL REFERENCES workspace(id) ON DELETE CASCADE,
        user_id text NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
        role_id uuid NOT NULL REFERENCES workspace_role(id) ON DELETE RESTRICT,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT uq_workspace_member UNIQUE (workspace_id, user_id)
      )`);
    await queryRunner.query(`CREATE INDEX idx_workspace_member_user ON workspace_member (user_id)`);

    await queryRunner.query(`
      CREATE TABLE space (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        workspace_id uuid NOT NULL REFERENCES workspace(id) ON DELETE CASCADE,
        name varchar(80) NOT NULL,
        color varchar(7) NOT NULL,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now()
      )`);
    await queryRunner.query(`CREATE INDEX idx_space_workspace ON space (workspace_id)`);

    await queryRunner.query(`
      CREATE TABLE task_list (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        workspace_id uuid NOT NULL REFERENCES workspace(id) ON DELETE CASCADE,
        space_id uuid NOT NULL REFERENCES space(id) ON DELETE CASCADE,
        name varchar(80) NOT NULL,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now()
      )`);
    await queryRunner.query(`CREATE INDEX idx_task_list_workspace_space ON task_list (workspace_id, space_id)`);

    await queryRunner.query(`
      CREATE TABLE task (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        workspace_id uuid NOT NULL REFERENCES workspace(id) ON DELETE CASCADE,
        list_id uuid NOT NULL REFERENCES task_list(id) ON DELETE CASCADE,
        title varchar(200) NOT NULL,
        description text NOT NULL DEFAULT '',
        status varchar(20) NOT NULL CHECK (status IN ('todo', 'in_progress', 'in_review', 'done')),
        priority varchar(10) NOT NULL CHECK (priority IN ('urgent', 'high', 'normal', 'low', 'none')),
        due_date timestamptz,
        assignee_id text REFERENCES "user"(id) ON DELETE SET NULL,
        position double precision NOT NULL,
        created_by_id text NOT NULL REFERENCES "user"(id) ON DELETE RESTRICT,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now()
      )`);
    await queryRunner.query(
      `CREATE INDEX idx_task_workspace_list_status_position ON task (workspace_id, list_id, status, position)`,
    );

    await queryRunner.query(`
      CREATE TABLE audit_log (
        id bigserial PRIMARY KEY,
        actor_id text NOT NULL,
        action varchar(80) NOT NULL,
        target_type varchar(40) NOT NULL,
        target_id text,
        workspace_id uuid,
        ip varchar(64),
        metadata jsonb NOT NULL DEFAULT '{}',
        created_at timestamptz NOT NULL DEFAULT now()
      )`);
    await queryRunner.query(`CREATE INDEX idx_audit_log_workspace_created ON audit_log (workspace_id, created_at)`);
    await queryRunner.query(`
      CREATE FUNCTION audit_log_append_only() RETURNS trigger LANGUAGE plpgsql AS $$
      BEGIN
        RAISE EXCEPTION 'audit_log is append-only';
      END;
      $$`);
    await queryRunner.query(`
      CREATE TRIGGER audit_log_no_change
      BEFORE UPDATE OR DELETE ON audit_log
      FOR EACH ROW EXECUTE FUNCTION audit_log_append_only()`);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS audit_log`);
    await queryRunner.query(`DROP FUNCTION IF EXISTS audit_log_append_only`);
    await queryRunner.query(`DROP TABLE IF EXISTS task`);
    await queryRunner.query(`DROP TABLE IF EXISTS task_list`);
    await queryRunner.query(`DROP TABLE IF EXISTS space`);
    await queryRunner.query(`DROP TABLE IF EXISTS workspace_member`);
    await queryRunner.query(`DROP TABLE IF EXISTS workspace_role`);
    await queryRunner.query(`DROP TABLE IF EXISTS workspace`);
  }
}
