import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';
import { afterAll, beforeAll, describe, expect, it, inject } from 'vitest';
import { TestUser } from './support/api-client.js';
import { runtimeDatabase, withScope } from './support/database.js';
import { addMember, createWorkspace, type WorkspaceFixture } from './support/fixtures.js';

const db = runtimeDatabase();
afterAll(() => db.end());

describe('custom roles and membership', () => {
  let ws: WorkspaceFixture;
  let member: TestUser;
  let qaRoleId: string;
  const vars = (extra: Record<string, unknown> = {}) => ({ w: ws.workspaceId, ...extra });
  const createRole = 'mutation($w: ID!, $input: CreateRoleInput!) { createRole(workspaceId: $w, input: $input) { id systemKey } }';
  const setRole = 'mutation($w: ID!, $u: ID!, $r: ID!) { updateMemberRole(workspaceId: $w, userId: $u, roleId: $r) { roleName } }';

  beforeAll(async () => {
    ws = await createWorkspace('Role owner');
    member = await TestUser.signUp('Role member');
    await addMember(ws, member, 'Member');
  });

  it('seeds the built-in roles in order', async () => {
    const { roles } = await ws.owner.data<{ roles: { name: string }[] }>('query($w: ID!) { roles(workspaceId: $w) { name } }', vars());
    expect(roles.map((role) => role.name)).toEqual(['Owner', 'Admin', 'Member', 'Guest']);
  });

  it('gives the same answer whether or not an email has an account', async () => {
    const add = 'mutation($w: ID!, $input: AddMemberInput!) { addMember(workspaceId: $w, input: $input) { message } }';
    const known = await ws.owner.data<{ addMember: { message: string } }>(add, vars({ input: { email: member.email, roleId: ws.roles.Member } }));
    const unknown = await ws.owner.data<{ addMember: { message: string } }>(add, vars({ input: { email: 'nobody@example.com', roleId: ws.roles.Member } }));
    expect(unknown.addMember.message).toBe(known.addMember.message);
  });

  it('creates custom roles but reserves owner-only permissions and locks built-in roles', async () => {
    const qa = await ws.owner.data<{ createRole: { id: string; systemKey: string | null } }>(
      createRole,
      vars({ input: { name: 'QA', permissions: ['task.view', 'task.update', 'members.manage'] } }),
    );
    expect(qa.createRole.systemKey).toBeNull();
    qaRoleId = qa.createRole.id;
    expect((await ws.owner.error(createRole, vars({ input: { name: 'Boss', permissions: ['workspace.manage'] } }))).message).toMatch(/reserved/);
    expect((await ws.owner.error(createRole, vars({ input: { name: 'Typo', permissions: ['task.fly'] } }))).code).toBe('BAD_USER_INPUT');
    const locked = await ws.owner.error('mutation($w: ID!, $r: ID!) { updateRole(workspaceId: $w, roleId: $r, input: { name: "Renamed" }) { id } }', vars({ r: ws.roles.Member }));
    expect(locked.message).toMatch(/cannot be changed/);
  });

  it('stops privilege escalation through role changes', async () => {
    expect((await ws.owner.data<{ updateMemberRole: { roleName: string } }>(setRole, vars({ u: member.id, r: qaRoleId }))).updateMemberRole.roleName).toBe('QA');
    expect((await member.error(setRole, vars({ u: ws.owner.id, r: ws.roles.Member }))).message).toMatch(/permissions you do not have/);
    expect((await member.error(setRole, vars({ u: member.id, r: ws.roles.Admin }))).message).toMatch(/own role/);
    const inUse = await ws.owner.error('mutation($w: ID!, $r: ID!) { deleteRole(workspaceId: $w, roleId: $r) }', vars({ r: qaRoleId }));
    expect(inUse.message).toMatch(/Reassign members/);
  });

  it('keeps at least one owner, and removes access when a member leaves', async () => {
    const leave = 'mutation($w: ID!) { leaveWorkspace(workspaceId: $w) }';
    expect((await ws.owner.error(leave, vars())).message).toMatch(/at least one owner/);
    expect((await member.data<{ leaveWorkspace: boolean }>(leave, vars())).leaveWorkspace).toBe(true);
    expect((await member.error('query($w: ID!) { workspace(workspaceId: $w) { id } }', vars())).code).toBe('NOT_FOUND');
  });

  it('writes an append-only audit trail, shown in the workspace without IP addresses', async () => {
    const actions = await withScope(db, { workspaceId: ws.workspaceId }, async (client) => {
      const rows = await client.query<{ action: string }>('SELECT action FROM audit_log WHERE workspace_id = $1 ORDER BY id', [ws.workspaceId]);
      return rows.rows.map((row) => row.action);
    });
    expect(actions).toEqual(expect.arrayContaining(['workspace.create', 'space.create', 'list.create', 'member.add', 'role.create', 'member.role_change', 'member.leave']));

    await expect(withScope(db, { platform: true }, (client) => client.query('DELETE FROM audit_log'))).rejects.toThrow(/append-only/);

    const { workspaceAuditLog } = await ws.owner.data<{ workspaceAuditLog: { total: number; items: { ip: string | null }[] } }>(
      'query($w: ID!) { workspaceAuditLog(workspaceId: $w, action: "member.") { total items { ip } } }',
      vars(),
    );
    expect(workspaceAuditLog.total).toBeGreaterThan(0);
    expect(workspaceAuditLog.items.every((entry) => entry.ip === null)).toBe(true);
  });
});

describe('platform admin', () => {
  let admin: TestUser;
  let other: TestUser;
  const updateUser = 'mutation($u: ID!, $input: UpdateAdminUserInput!) { updateAdminUser(userId: $u, input: $input) { platformRole suspended } }';

  beforeAll(async () => {
    admin = await TestUser.signUp('Admin');
    other = await TestUser.signUp('Other');
  });

  it('hides admin operations from everyone else', async () => {
    expect((await admin.error('{ adminUsers { total } }')).code).toBe('NOT_FOUND');
  });

  it('promotes through the operator CLI only', () => {
    const result = spawnSync('node', ['dist/cli/promote-super-admin.js', admin.email], {
      cwd: resolve(import.meta.dirname, '../..'),
      env: inject('apiEnv'),
      encoding: 'utf8',
    });
    expect(result.stdout).toMatch(/Granted SUPER_ADMIN/);
  });

  it('searches users and workspaces across the platform', async () => {
    const { me } = await admin.data<{ me: { platformRole: string } }>('{ me { platformRole } }');
    expect(me.platformRole).toBe('SUPER_ADMIN');
    const { adminUsers } = await admin.data<{ adminUsers: { total: number; items: { email: string }[] } }>(
      'query($s: String) { adminUsers(search: $s) { total items { email } } }',
      { s: other.email },
    );
    expect(adminUsers.items.map((user) => user.email)).toEqual([other.email]);
    const workspace = await createWorkspace('Tenant', 'Platform visible');
    const { adminWorkspaces } = await admin.data<{ adminWorkspaces: { items: { id: string }[] } }>(
      'query { adminWorkspaces(search: "Platform visible", pageSize: 100) { items { id } } }',
    );
    expect(adminWorkspaces.items.map((item) => item.id)).toContain(workspace.workspaceId);
  });

  it("can't change its own account, and can promote and demote others", async () => {
    expect((await admin.error(updateUser, { u: admin.id, input: { platformRole: 'USER' } })).message).toMatch(/your own/);
    expect((await admin.data<{ updateAdminUser: { platformRole: string } }>(updateUser, { u: other.id, input: { platformRole: 'SUPER_ADMIN' } })).updateAdminUser.platformRole).toBe('SUPER_ADMIN');
    expect((await admin.data<{ updateAdminUser: { platformRole: string } }>(updateUser, { u: other.id, input: { platformRole: 'USER' } })).updateAdminUser.platformRole).toBe('USER');
  });

  it('signs suspended users out everywhere and logs the action with its IP', async () => {
    expect((await admin.data<{ updateAdminUser: { suspended: boolean } }>(updateUser, { u: other.id, input: { suspended: true } })).updateAdminUser.suspended).toBe(true);
    expect((await other.error('{ me { id } }')).code).toBe('UNAUTHENTICATED');
    const { adminAuditLog } = await admin.data<{ adminAuditLog: { items: { targetId: string; ip: string | null }[] } }>(
      'query { adminAuditLog(action: "admin.user.suspend") { items { targetId ip } } }',
    );
    const entry = adminAuditLog.items.find((item) => item.targetId === other.id);
    expect(entry?.ip).toBe(admin.ip);
  });

  it("enters any workspace, and audits its writes there", async () => {
    const tenant = await createWorkspace('Tenant two');
    await admin.data('mutation($w: ID!) { createSpace(workspaceId: $w, input: { name: "Support" }) { id } }', { w: tenant.workspaceId });
    const { workspaceAuditLog } = await tenant.owner.data<{ workspaceAuditLog: { items: { action: string; actorId: string }[] } }>(
      'query($w: ID!) { workspaceAuditLog(workspaceId: $w, action: "platform_admin.") { items { action actorId } } }',
      { w: tenant.workspaceId },
    );
    expect(workspaceAuditLog.items).toEqual([{ action: 'platform_admin.workspace_write', actorId: admin.id }]);
  });
});
