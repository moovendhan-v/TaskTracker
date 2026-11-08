import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * A3: organizations above workspaces. See docs/plan/A3_ORGANIZATIONS.md.
 *
 * A new `organization` scope (app.org_id), set by the API only after it checked the
 * caller's membership, limits organization rows like the workspace scope does. Outside
 * it, people read their own memberships (how the API checks them) and the organizations
 * of workspaces they're in (so an organization-wide rule applies there).
 */
export class Organizations1729990000000 implements MigrationInterface {
  name = 'Organizations1729990000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    const q = (sql: string) => queryRunner.query(sql);
    await q(`
      CREATE FUNCTION app_current_org_id() RETURNS uuid LANGUAGE sql STABLE AS $$
        SELECT nullif(current_setting('app.org_id', true), '')::uuid
      $$`);
    await q(`
      CREATE FUNCTION app_can_access_org(target uuid) RETURNS boolean LANGUAGE sql STABLE AS $$
        SELECT app_is_platform_scope() OR target = app_current_org_id()
      $$`);

    await q(`
      CREATE TABLE organization (
        id uuid PRIMARY KEY,
        name text NOT NULL,
        two_step_required text NOT NULL DEFAULT 'off',
        created_by text NOT NULL REFERENCES "user"(id),
        created_at timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT chk_organization_name CHECK (length(btrim(name)) BETWEEN 1 AND 80),
        CONSTRAINT chk_organization_two_step CHECK (two_step_required IN ('off', 'admins', 'everyone'))
      )`);
    await q(`
      CREATE TABLE organization_member (
        organization_id uuid NOT NULL REFERENCES organization(id) ON DELETE CASCADE,
        user_id text NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
        role text NOT NULL,
        created_at timestamptz NOT NULL DEFAULT now(),
        PRIMARY KEY (organization_id, user_id),
        CONSTRAINT chk_organization_member_role CHECK (role IN ('owner', 'admin', 'member'))
      )`);
    await q(`CREATE INDEX idx_organization_member_user ON organization_member (user_id)`);
    await q(`ALTER TABLE workspace ADD COLUMN organization_id uuid REFERENCES organization(id) ON DELETE SET NULL`);
    await q(`CREATE INDEX idx_workspace_organization ON workspace (organization_id) WHERE organization_id IS NOT NULL`);
    // No foreign key: the audit log is append-only and outlives the organization.
    await q(`ALTER TABLE audit_log ADD COLUMN organization_id uuid`);
    await q(`CREATE INDEX idx_audit_log_organization_created ON audit_log (organization_id, created_at) WHERE organization_id IS NOT NULL`);

    for (const table of ['organization', 'organization_member']) {
      await q(`ALTER TABLE ${table} ENABLE ROW LEVEL SECURITY`);
      await q(`ALTER TABLE ${table} FORCE ROW LEVEL SECURITY`);
    }
    await q(`CREATE POLICY tenant_isolation ON organization USING (app_can_access_org(id)) WITH CHECK (app_can_access_org(id))`);
    await q(`
      CREATE POLICY member_organization_read ON organization FOR SELECT
      USING (id IN (SELECT organization_id FROM organization_member WHERE user_id = app_current_user_id()))`);
    // The workspace's own policies decide which workspaces are visible; their organizations follow.
    await q(`
      CREATE POLICY workspace_organization_read ON organization FOR SELECT
      USING (id IN (SELECT organization_id FROM workspace WHERE organization_id IS NOT NULL))`);
    await q(`
      CREATE POLICY tenant_isolation ON organization_member
      USING (app_can_access_org(organization_id)) WITH CHECK (app_can_access_org(organization_id))`);
    await q(`CREATE POLICY own_membership_read ON organization_member FOR SELECT USING (user_id = app_current_user_id())`);

    // Inside an organization's scope, its workspaces (the service returns names only).
    await q(`
      CREATE POLICY organization_workspace_read ON workspace FOR SELECT
      USING (organization_id IS NOT NULL AND app_can_access_org(organization_id))`);
    // Organization activity: written and read in that organization's scope, or by a workspace in it.
    await q(`
      CREATE POLICY organization_audit_read ON audit_log FOR SELECT
      USING (organization_id IS NOT NULL AND app_can_access_org(organization_id))`);
    await q(`
      CREATE POLICY organization_audit_insert ON audit_log FOR INSERT
      WITH CHECK (workspace_id IS NULL AND organization_id IS NOT NULL AND app_can_access_org(organization_id))`);

    // Only an owner or admin of an organization can put a workspace in it.
    await q(`
      CREATE FUNCTION workspace_organization_guard() RETURNS trigger LANGUAGE plpgsql AS $$
      BEGIN
        IF NEW.organization_id IS NOT NULL AND NEW.organization_id IS DISTINCT FROM OLD.organization_id AND NOT app_is_platform_scope()
          AND NOT EXISTS (
            SELECT 1 FROM organization_member
            WHERE organization_id = NEW.organization_id AND user_id = app_current_user_id() AND role IN ('owner', 'admin')
          ) THEN
          RAISE EXCEPTION 'only an owner or admin of the organization can add a workspace to it' USING ERRCODE = 'insufficient_privilege';
        END IF;
        RETURN NEW;
      END $$`);
    await q(`CREATE TRIGGER trg_workspace_organization_guard BEFORE UPDATE OF organization_id ON workspace FOR EACH ROW EXECUTE FUNCTION workspace_organization_guard()`);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    const q = (sql: string) => queryRunner.query(sql);
    await q(`DROP TRIGGER IF EXISTS trg_workspace_organization_guard ON workspace`);
    await q(`DROP FUNCTION IF EXISTS workspace_organization_guard()`);
    await q(`DROP POLICY IF EXISTS organization_audit_insert ON audit_log`);
    await q(`DROP POLICY IF EXISTS organization_audit_read ON audit_log`);
    await q(`DROP POLICY IF EXISTS organization_workspace_read ON workspace`);
    await q(`ALTER TABLE audit_log DROP COLUMN organization_id`);
    await q(`ALTER TABLE workspace DROP COLUMN organization_id`);
    await q(`DROP TABLE IF EXISTS organization_member`);
    await q(`DROP TABLE IF EXISTS organization`);
    await q(`DROP FUNCTION IF EXISTS app_can_access_org(uuid)`);
    await q(`DROP FUNCTION IF EXISTS app_current_org_id()`);
  }
}
