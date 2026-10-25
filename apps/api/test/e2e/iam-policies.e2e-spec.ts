import { beforeAll, describe, expect, it } from 'vitest';
import { TestUser } from './support/api-client.js';
import { addMember, createWorkspace, type WorkspaceFixture } from './support/fixtures.js';

const MEMBERS = 'query($w: ID!) { members(workspaceId: $w) { userId name email } }';
const ROLES = 'query($w: ID!) { roles(workspaceId: $w) { id name systemKey effectivePermissions readableFields policies { ref name managed } inlinePolicy { statements { effect permissions fields } } } }';
const CREATE_POLICY = 'mutation($w: ID!, $input: SavePolicyInput!) { createPolicy(workspaceId: $w, input: $input) { id name managed document { statements { effect permissions fields } } } }';
const ATTACH = 'mutation($w: ID!, $r: ID!, $p: String!) { attachRolePolicy(workspaceId: $w, roleId: $r, policy: $p) { id policies { ref } effectivePermissions readableFields } }';
const DETACH = 'mutation($w: ID!, $r: ID!, $p: String!) { detachRolePolicy(workspaceId: $w, roleId: $r, policy: $p) { id policies { ref } readableFields } }';
const INLINE = 'mutation($w: ID!, $r: ID!, $d: PolicyDocumentInput!) { setRoleInlinePolicy(workspaceId: $w, roleId: $r, document: $d) { id effectivePermissions readableFields } }';

interface Member {
  userId: string;
  name: string;
  email: string | null;
}

describe('IAM: managed, custom and inline policies with field-level access', () => {
  let ws: WorkspaceFixture;
  let admin: TestUser;
  let member: TestUser;
  const vars = (extra: Record<string, unknown> = {}) => ({ w: ws.workspaceId, ...extra });
  const emailsSeenBy = async (user: TestUser) => (await user.data<{ members: Member[] }>(MEMBERS, vars())).members.map((m) => m.email);

  beforeAll(async () => {
    ws = await createWorkspace('IAM owner');
    admin = await TestUser.signUp('IAM admin');
    member = await TestUser.signUp('IAM member');
    await addMember(ws, admin, 'Admin');
    await addMember(ws, member, 'Member');
  });

  it('gives built-in roles managed policies and reports what they add up to', async () => {
    const { roles } = await ws.owner.data<{ roles: { name: string; policies: { ref: string }[]; effectivePermissions: string[]; readableFields: string[] }[] }>(ROLES, vars());
    const byName = Object.fromEntries(roles.map((role) => [role.name, role]));
    expect(byName['Owner']?.policies.map((p) => p.ref)).toEqual(['managed:FullAccess']);
    expect(byName['Admin']?.effectivePermissions).not.toContain('workspace.manage');
    expect(byName['Admin']?.readableFields).toContain('member.email');
    expect(byName['Member']?.readableFields).not.toContain('member.email');
    expect(byName['Guest']?.effectivePermissions).toEqual(['task.view', 'doc.view']);
  });

  it('shows member emails only to roles allowed to read them; others get null', async () => {
    expect(await emailsSeenBy(ws.owner)).toContain(member.email);
    expect(await emailsSeenBy(admin)).toContain(member.email);
    expect((await emailsSeenBy(member)).every((email) => email === null)).toBe(true);
  });

  it("doesn't let anyone filter, sort or search by a field they can't read", async () => {
    const search = 'query($w: ID!, $q: ResourceQueryInput) { searchMembers(workspaceId: $w, query: $q) { total items { name email } } }';
    expect((await member.error(search, vars({ q: { where: `email=${encodeURIComponent(admin.email)}` } }))).message).toBe('Unknown field email');
    expect((await member.error(search, vars({ q: { sort: [{ field: 'email', direction: 'asc' }] } }))).code).toBe('BAD_USER_INPUT');
    // Searching "@example.com" matches emails for the owner, but only names for the member.
    expect((await ws.owner.data<{ searchMembers: { total: number } }>(search, vars({ q: { search: '@example.com' } }))).searchMembers.total).toBe(3);
    expect((await member.data<{ searchMembers: { total: number } }>(search, vars({ q: { search: '@example.com' } }))).searchMembers.total).toBe(0);
    const { resourceSchema } = await member.data<{ resourceSchema: { fields: { name: string }[] } }>(
      'query($w: ID!) { resourceSchema(workspaceId: $w, resource: "members") { fields { name } } }',
      vars(),
    );
    expect(resourceSchema.fields.map((field) => field.name)).toEqual(['name', 'roleId', 'joinedAt']);
  });

  it('lets an owner write a custom policy and attach it, taking effect immediately', async () => {
    const { createPolicy } = await ws.owner.data<{ createPolicy: { id: string } }>(CREATE_POLICY, vars({
      input: { name: 'See member emails', description: 'For coordinators', document: { statements: [{ effect: 'allow', fields: ['member.email'] }] } },
    }));
    const { attachRolePolicy } = await ws.owner.data<{ attachRolePolicy: { readableFields: string[] } }>(ATTACH, vars({ r: ws.roles.Member, p: createPolicy.id }));
    expect(attachRolePolicy.readableFields).toContain('member.email');
    expect(await emailsSeenBy(member)).toContain(admin.email);

    const { myAccess } = await member.data<{ myAccess: { readableFields: string[] } }>('query($w: ID!) { myAccess(workspaceId: $w) { permissions readableFields } }', vars());
    expect(myAccess.readableFields).toContain('member.email');

    await ws.owner.data(DETACH, vars({ r: ws.roles.Member, p: createPolicy.id }));
    expect((await emailsSeenBy(member)).every((email) => email === null)).toBe(true);
  });

  it('lets deny win over allow', async () => {
    await ws.owner.data(ATTACH, vars({ r: ws.roles.Admin, p: 'managed:HideMemberEmails' }));
    expect((await emailsSeenBy(admin)).every((email) => email === null)).toBe(true);

    // The admin can no longer see emails, so they can't lift the deny for their own role either.
    expect((await admin.error(DETACH, vars({ r: ws.roles.Admin, p: 'managed:HideMemberEmails' }))).code).toBe('FORBIDDEN');
    await ws.owner.data(DETACH, vars({ r: ws.roles.Admin, p: 'managed:HideMemberEmails' }));
    expect(await emailsSeenBy(admin)).toContain(member.email);
  });

  it('blocks privilege escalation', async () => {
    // Nobody but the owner role gets workspace.manage, not even through a custom policy.
    const reserved = await ws.owner.error(CREATE_POLICY, vars({ input: { name: 'Root', document: { statements: [{ effect: 'allow', permissions: ['workspace.manage'] }] } } }));
    expect(reserved.code).toBe('BAD_USER_INPUT');
    // An admin can't give a role full access, which includes deleting the workspace.
    expect((await admin.error(ATTACH, vars({ r: ws.roles.Member, p: 'managed:FullAccess' }))).code).toBe('FORBIDDEN');
    // Members can't manage policies at all.
    expect((await member.error(ATTACH, vars({ r: ws.roles.Member, p: 'managed:WorkspaceAdmin' }))).code).toBe('FORBIDDEN');
    // The owner role is never changed, so owners can't be locked out.
    expect((await ws.owner.error(ATTACH, vars({ r: ws.roles.Owner, p: 'managed:HideMemberEmails' }))).code).toBe('BAD_USER_INPUT');
  });

  it('applies inline statements, including denies of permissions', async () => {
    const { setRoleInlinePolicy } = await ws.owner.data<{ setRoleInlinePolicy: { effectivePermissions: string[] } }>(INLINE, vars({
      r: ws.roles.Member,
      d: { statements: [{ effect: 'deny', permissions: ['task.create'] }] },
    }));
    expect(setRoleInlinePolicy.effectivePermissions).not.toContain('task.create');
    const create = await member.error('mutation($w: ID!, $l: ID!) { createTask(workspaceId: $w, listId: $l, input: { title: "Blocked" }) { id } }', vars({ l: ws.listId }));
    expect(create.code).toBe('FORBIDDEN');
    await ws.owner.data(INLINE, vars({ r: ws.roles.Member, d: { statements: [] } }));
    await member.data('mutation($w: ID!, $l: ID!) { createTask(workspaceId: $w, listId: $l, input: { title: "Allowed again" }) { id } }', vars({ l: ws.listId }));
  });

  it('validates policy documents', async () => {
    const bad = async (statements: unknown[]) => (await ws.owner.error(CREATE_POLICY, vars({ input: { name: `Bad ${Math.random()}`, document: { statements } } }))).message;
    expect(await bad([{ effect: 'allow', permissions: ['tasks.fly'] }])).toMatch(/unknown permission/);
    expect(await bad([{ effect: 'allow', fields: ['member.password'] }])).toMatch(/unknown field/);
    expect(await bad([{ effect: 'allow' }])).toMatch(/needs permissions or fields/);
  });

  it('records policy changes in the audit log', async () => {
    const { workspaceAuditLog } = await ws.owner.data<{ workspaceAuditLog: { items: { action: string }[] } }>(
      'query($w: ID!) { workspaceAuditLog(workspaceId: $w, pageSize: 50) { items { action } } }',
      vars(),
    );
    const actions = new Set(workspaceAuditLog.items.map((item) => item.action));
    for (const action of ['policy.create', 'role.policy_attach', 'role.policy_detach', 'role.inline_policy']) expect(actions).toContain(action);
  });
});
