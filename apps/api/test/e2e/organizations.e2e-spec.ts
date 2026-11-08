import { beforeAll, describe, expect, it } from 'vitest';
import { PASSWORD, TestUser } from './support/api-client.js';
import { runtimeDatabase, withScope } from './support/database.js';
import { addMember, createWorkspace, type WorkspaceFixture } from './support/fixtures.js';
import { totp } from './support/totp.js';

const CREATE = 'mutation($n: String!) { createOrganization(name: $n) { id name role twoStepRequired } }';
const MINE = '{ organizations { id name role } }';
const ORG = 'query($o: ID!) { organization(organizationId: $o) { id name role } }';
const MEMBERS = 'query($o: ID!) { organizationMembers(organizationId: $o) { userId name role } }';
const WORKSPACES = 'query($o: ID!) { organizationWorkspaces(organizationId: $o) { id name } }';
const ACTIVITY = 'query($o: ID!) { organizationActivity(organizationId: $o) { action actorName metadata } }';
const ADD = 'mutation($o: ID!, $e: String!, $r: String!) { addOrganizationMember(organizationId: $o, email: $e, role: $r) { userId role } }';
const ROLE = 'mutation($o: ID!, $u: String!, $r: String!) { setOrganizationMemberRole(organizationId: $o, userId: $u, role: $r) { userId role } }';
const REMOVE = 'mutation($o: ID!, $u: String!) { removeOrganizationMember(organizationId: $o, userId: $u) { userId } }';
const ATTACH = 'mutation($w: ID!, $o: ID!) { addWorkspaceToOrganization(workspaceId: $w, organizationId: $o) }';
const DETACH = 'mutation($w: ID!) { removeWorkspaceFromOrganization(workspaceId: $w) }';
const OF_WORKSPACE = 'query($w: ID!) { workspaceOrganization(workspaceId: $w) { id name twoStepRequired } }';
const ORG_TWO_STEP = 'mutation($o: ID!, $r: String!) { setOrganizationTwoStep(organizationId: $o, require: $r) { twoStepRequired } }';
const WS_POLICY = 'query($w: ID!) { twoStepPolicy(workspaceId: $w) { require organizationRequire organizationName } }';
const WORKSPACE = 'query($w: ID!) { workspace(workspaceId: $w) { permissions twoStepMissing } }';
const DELETE = 'mutation($o: ID!) { deleteOrganization(organizationId: $o) }';

async function turnOnTwoStep(user: TestUser): Promise<void> {
  const { totpURI } = (await (await user.auth('two-factor/enable', { password: PASSWORD })).json()) as { totpURI: string };
  expect((await user.auth('two-factor/verify-totp', { code: totp(new URL(totpURI).searchParams.get('secret')!) })).status).toBe(200);
}

/** A3: organizations above workspaces. */
describe('organizations', () => {
  let ws: WorkspaceFixture;
  let owner: TestUser;
  let admin: TestUser;
  let member: TestUser;
  let stranger: TestUser;
  let o: string;

  beforeAll(async () => {
    ws = await createWorkspace('Org owner', 'Org workspace');
    owner = ws.owner;
    admin = await TestUser.signUp('Org admin');
    member = await TestUser.signUp('Org member');
    stranger = await TestUser.signUp('Org stranger');
  });

  it('is created by anyone, who becomes its owner, and is invisible to others', async () => {
    const created = (await owner.data<{ createOrganization: { id: string; role: string; twoStepRequired: string } }>(CREATE, { n: '  Northwind  ' })).createOrganization;
    o = created.id;
    expect(created).toMatchObject({ role: 'owner', twoStepRequired: 'off' });
    expect((await owner.data<{ organizations: { name: string }[] }>(MINE)).organizations.map((org) => org.name)).toContain('Northwind');
    expect((await stranger.error(ORG, { o })).code).toBe('NOT_FOUND');
    expect((await stranger.error(MEMBERS, { o })).code).toBe('NOT_FOUND');
    expect((await stranger.data<{ organizations: unknown[] }>(MINE)).organizations).toEqual([]);
    expect((await owner.error(CREATE, { n: ' ' })).message).toMatch(/name of up to 80/);
  });

  it('adds people with confirmed accounts, and only owners make owners', async () => {
    await owner.data(ADD, { o, e: admin.email, r: 'admin' });
    await owner.data(ADD, { o, e: member.email, r: 'member' });
    expect((await owner.error(ADD, { o, e: 'nobody@example.com', r: 'member' })).message).toMatch(/No one with a confirmed account/);
    const unconfirmed = await TestUser.signUp('Org unconfirmed', { confirmEmail: false });
    expect((await owner.error(ADD, { o, e: unconfirmed.email, r: 'member' })).message).toMatch(/No one with a confirmed account/);
    expect((await owner.error(ADD, { o, e: member.email, r: 'member' })).message).toMatch(/already in the organization/);

    // Members see the organization but don't run it.
    expect((await member.data<{ organizationMembers: { role: string }[] }>(MEMBERS, { o })).organizationMembers).toHaveLength(3);
    expect((await member.error(ADD, { o, e: stranger.email, r: 'member' })).code).toBe('FORBIDDEN');
    expect((await member.error(ACTIVITY, { o })).code).toBe('FORBIDDEN');
    // Admins run it, but can't hand out ownership.
    expect((await admin.error(ADD, { o, e: stranger.email, r: 'owner' })).code).toBe('FORBIDDEN');
    expect((await admin.error(ROLE, { o, u: member.id, r: 'owner' })).code).toBe('FORBIDDEN');
    expect((await admin.error(REMOVE, { o, u: owner.id })).code).toBe('FORBIDDEN');
  });

  it('always keeps an owner', async () => {
    expect((await owner.error(ROLE, { o, u: owner.id, r: 'admin' })).message).toMatch(/needs an owner/);
    expect((await owner.error(REMOVE, { o, u: owner.id })).message).toMatch(/needs an owner/);
    // Anyone can leave.
    const leaver = await TestUser.signUp('Org leaver');
    await owner.data(ADD, { o, e: leaver.email, r: 'member' });
    expect((await leaver.data<{ removeOrganizationMember: unknown[] }>(REMOVE, { o, u: leaver.id })).removeOrganizationMember).toEqual([]);
    expect((await leaver.error(ORG, { o })).code).toBe('NOT_FOUND');
  });

  it('takes in a workspace only from someone who runs both', async () => {
    // A workspace admin who isn't an owner or admin of the organization can't.
    await addMember(ws, member, 'Admin');
    expect((await member.error(ATTACH, { w: ws.workspaceId, o })).code).toBe('FORBIDDEN');
    // The database refuses it too, whatever the API does.
    const pool = runtimeDatabase();
    await expect(
      withScope(pool, { workspaceId: ws.workspaceId, userId: member.id }, (client) => client.query('UPDATE workspace SET organization_id = $1 WHERE id = $2', [o, ws.workspaceId])),
    ).rejects.toThrow(/only an owner or admin of the organization/);
    await pool.end();

    expect((await owner.data<{ addWorkspaceToOrganization: boolean }>(ATTACH, { w: ws.workspaceId, o })).addWorkspaceToOrganization).toBe(true);
    expect((await member.data<{ workspaceOrganization: { name: string } }>(OF_WORKSPACE, { w: ws.workspaceId })).workspaceOrganization.name).toBe('Northwind');
    // Organization members see it by name; that doesn't let them in.
    expect((await admin.data<{ organizationWorkspaces: { name: string }[] }>(WORKSPACES, { o })).organizationWorkspaces.map((w) => w.name)).toEqual(['Org workspace']);
    expect((await admin.error(WORKSPACE, { w: ws.workspaceId })).code).toBe('NOT_FOUND');
  });

  it("limits each organization's scope to its own rows", async () => {
    const other = (await stranger.data<{ createOrganization: { id: string } }>(CREATE, { n: 'Other org' })).createOrganization.id;
    const pool = runtimeDatabase();
    try {
      const seen = await withScope(pool, { userId: owner.id }, async (client) => {
        await client.query(`SELECT set_config('app.org_id', $1, true)`, [o]);
        return {
          orgs: (await client.query<{ id: string }>('SELECT id FROM organization')).rows.map((row) => row.id),
          members: (await client.query<{ organization_id: string }>('SELECT DISTINCT organization_id FROM organization_member')).rows.map((row) => row.organization_id),
          tasks: (await client.query('SELECT id FROM task')).rowCount,
        };
      });
      expect(seen.orgs).toEqual([o]);
      expect(seen.members).toEqual([o]);
      // Its workspaces' data stays theirs.
      expect(seen.tasks).toBe(0);
      // Outside any organization, only your own memberships.
      const outside = await withScope(pool, { userId: owner.id }, async (client) => (await client.query<{ organization_id: string }>('SELECT organization_id FROM organization_member')).rows);
      expect(outside.map((row) => row.organization_id)).toEqual([o]);
      expect(outside).not.toContainEqual({ organization_id: other });
    } finally {
      await pool.end();
    }
  });

  it('requires two-step sign-in in all its workspaces, on top of their own rule', async () => {
    expect((await owner.error(ORG_TWO_STEP, { o, r: 'admins' })).message).toMatch(/for yourself first/);
    await turnOnTwoStep(owner);
    await owner.data(ORG_TWO_STEP, { o, r: 'admins' });
    // The workspace's own rule is still off; the organization's applies.
    expect((await owner.data<{ twoStepPolicy: unknown }>(WS_POLICY, { w: ws.workspaceId })).twoStepPolicy).toEqual({ require: 'off', organizationRequire: 'admins', organizationName: 'Northwind' });
    const held = (await member.data<{ workspace: { permissions: string[]; twoStepMissing: boolean } }>(WORKSPACE, { w: ws.workspaceId })).workspace;
    expect(held.twoStepMissing).toBe(true);
    expect(held.permissions).not.toContain('workspace.manage');

    // Out of the organization, the workspace's own rule is back.
    await owner.data(DETACH, { w: ws.workspaceId });
    expect((await member.data<{ workspace: { twoStepMissing: boolean } }>(WORKSPACE, { w: ws.workspaceId })).workspace.twoStepMissing).toBe(false);
  });

  it('records what happened, and deleting it keeps its workspaces', async () => {
    await owner.data(ATTACH, { w: ws.workspaceId, o });
    const activity = (await admin.data<{ organizationActivity: { action: string }[] }>(ACTIVITY, { o })).organizationActivity.map((entry) => entry.action);
    expect(activity).toEqual(
      expect.arrayContaining([
        'organization.create',
        'organization.member.add',
        'organization.member.leave',
        'organization.workspace.add',
        'organization.workspace.remove',
        'organization.two_step.update',
      ]),
    );
    expect((await admin.error(DELETE, { o })).code).toBe('FORBIDDEN');
    expect((await owner.data<{ deleteOrganization: boolean }>(DELETE, { o })).deleteOrganization).toBe(true);
    expect((await owner.data<{ workspaceOrganization: unknown }>(OF_WORKSPACE, { w: ws.workspaceId })).workspaceOrganization).toBeNull();
    expect((await owner.gql(WORKSPACE, { w: ws.workspaceId })).errors).toBeUndefined();
  });
});
