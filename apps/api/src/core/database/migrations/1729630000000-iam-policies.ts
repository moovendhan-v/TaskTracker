import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Policies for roles, in the style of cloud IAM:
 * - `policy`: a workspace's own reusable policies (managed ones live in code);
 * - `role_policy`: which policies (managed by key, or custom by id) a role uses;
 * - `workspace_role.inline_policy`: statements that belong to one role only.
 * Built-in roles get their rights from managed policies from now on.
 */
export class IamPolicies1729630000000 implements MigrationInterface {
  name = 'IamPolicies1729630000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE policy (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        workspace_id uuid NOT NULL REFERENCES workspace(id) ON DELETE CASCADE,
        name varchar(80) NOT NULL,
        description varchar(300) NOT NULL DEFAULT '',
        document jsonb NOT NULL,
        created_by_id text REFERENCES "user"(id) ON DELETE SET NULL,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT chk_policy_document CHECK (jsonb_typeof(document -> 'statements') = 'array')
      )`);
    await queryRunner.query(`CREATE UNIQUE INDEX uq_policy_name ON policy (workspace_id, lower(name))`);

    await queryRunner.query(`ALTER TABLE workspace_role ADD COLUMN inline_policy jsonb NOT NULL DEFAULT '{"statements": []}'::jsonb`);
    await queryRunner.query(
      `ALTER TABLE workspace_role ADD CONSTRAINT chk_role_inline_policy CHECK (jsonb_typeof(inline_policy -> 'statements') = 'array')`,
    );

    await queryRunner.query(`
      CREATE TABLE role_policy (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        workspace_id uuid NOT NULL REFERENCES workspace(id) ON DELETE CASCADE,
        role_id uuid NOT NULL REFERENCES workspace_role(id) ON DELETE CASCADE,
        managed_key varchar(60),
        policy_id uuid REFERENCES policy(id) ON DELETE CASCADE,
        created_at timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT chk_role_policy_target CHECK ((managed_key IS NULL) <> (policy_id IS NULL))
      )`);
    await queryRunner.query(`CREATE UNIQUE INDEX uq_role_policy_managed ON role_policy (role_id, managed_key) WHERE managed_key IS NOT NULL`);
    await queryRunner.query(`CREATE UNIQUE INDEX uq_role_policy_custom ON role_policy (role_id, policy_id) WHERE policy_id IS NOT NULL`);
    await queryRunner.query(`CREATE INDEX idx_role_policy_policy ON role_policy (policy_id) WHERE policy_id IS NOT NULL`);

    for (const table of ['policy', 'role_policy']) {
      await queryRunner.query(`ALTER TABLE ${table} ENABLE ROW LEVEL SECURITY`);
      await queryRunner.query(`ALTER TABLE ${table} FORCE ROW LEVEL SECURITY`);
      await queryRunner.query(`
        CREATE POLICY tenant_isolation ON ${table}
        USING (app_can_access_workspace(workspace_id))
        WITH CHECK (app_can_access_workspace(workspace_id))`);
    }
    // Like held_role_read: access checks run in user scope and must see the policies of the roles a user holds.
    await queryRunner.query(`
      CREATE POLICY held_role_policy_read ON role_policy FOR SELECT
      USING (role_id IN (SELECT role_id FROM workspace_member WHERE user_id = app_current_user_id()))`);
    await queryRunner.query(`
      CREATE POLICY held_policy_read ON policy FOR SELECT
      USING (id IN (SELECT policy_id FROM role_policy WHERE role_id IN (SELECT role_id FROM workspace_member WHERE user_id = app_current_user_id())))`);

    // Built-in roles now take their rights from managed policies.
    await queryRunner.query(`
      INSERT INTO role_policy (workspace_id, role_id, managed_key)
      SELECT workspace_id, id, CASE system_key
          WHEN 'owner' THEN 'FullAccess'
          WHEN 'admin' THEN 'WorkspaceAdmin'
          WHEN 'member' THEN 'Contributor'
          ELSE 'ReadOnly' END
      FROM workspace_role WHERE system_key IS NOT NULL`);
    await queryRunner.query(`UPDATE workspace_role SET permissions = '{}' WHERE system_key IS NOT NULL`);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      UPDATE workspace_role SET permissions = CASE system_key
          WHEN 'owner' THEN ARRAY['workspace.manage','members.manage','roles.manage','space.manage','list.manage','task.view','task.create','task.update','task.delete','task.assign','sprint.manage','doc.view','doc.create','doc.manage','hr.view','hr.manage','leave.request','leave.approve','audit.view']
          WHEN 'admin' THEN ARRAY['members.manage','roles.manage','space.manage','list.manage','task.view','task.create','task.update','task.delete','task.assign','sprint.manage','doc.view','doc.create','doc.manage','hr.view','hr.manage','leave.request','leave.approve','audit.view']
          WHEN 'member' THEN ARRAY['task.view','task.create','task.update','task.assign','doc.view','doc.create','hr.view','leave.request']
          ELSE ARRAY['task.view','doc.view'] END
      WHERE system_key IS NOT NULL`);
    await queryRunner.query(`DROP TABLE role_policy`);
    await queryRunner.query(`ALTER TABLE workspace_role DROP COLUMN inline_policy`);
    await queryRunner.query(`DROP TABLE policy`);
  }
}
