import { beforeAll, describe, expect, it } from 'vitest';
import { PASSWORD, TestUser } from './support/api-client.js';
import { addMember, createWorkspace, type WorkspaceFixture } from './support/fixtures.js';
import { totp } from './support/totp.js';

const POLICY = 'query($w: ID!) { twoStepPolicy(workspaceId: $w) { require callerHasTwoStep } }';
const SET = 'mutation($w: ID!, $r: String!) { setTwoStepRequirement(workspaceId: $w, require: $r) { require callerHasTwoStep } }';
const WORKSPACE = 'query($w: ID!) { workspace(workspaceId: $w) { permissions twoStepMissing } }';
const NEW_TASK = 'mutation($w: ID!, $l: ID!) { createTask(workspaceId: $w, listId: $l, input: { title: "Two-step" }) { id } }';
const ADD_MEMBER = 'mutation($w: ID!, $input: AddMemberInput!) { addMember(workspaceId: $w, input: $input) { message } }';
const AUDIT = 'query($w: ID!, $q: ResourceQueryInput) { searchWorkspaceAuditLog(workspaceId: $w, query: $q) { items { action metadata } } }';

/** Turns on two-step sign-in with an authenticator app, as the Security page does. */
async function turnOnTwoStep(user: TestUser): Promise<void> {
  const { totpURI } = (await (await user.auth('two-factor/enable', { password: PASSWORD })).json()) as { totpURI: string };
  const response = await user.auth('two-factor/verify-totp', { code: totp(new URL(totpURI).searchParams.get('secret')!) });
  expect(response.status).toBe(200);
}

const workspace = async (user: TestUser, w: string) => (await user.data<{ workspace: { permissions: string[]; twoStepMissing: boolean } }>(WORKSPACE, { w })).workspace;

/** A4 / E3: a workspace can require two-step sign-in of its admins or of everyone. */
describe('requiring two-step sign-in', () => {
  let ws: WorkspaceFixture;
  let w: string;
  let admin: TestUser;
  let member: TestUser;

  beforeAll(async () => {
    ws = await createWorkspace('Two-step owner');
    w = ws.workspaceId;
    admin = await TestUser.signUp('Two-step admin');
    member = await TestUser.signUp('Two-step member');
    await addMember(ws, admin, 'Admin');
    await addMember(ws, member, 'Member');
  });

  it("can't be turned on by someone who doesn't have it, so nobody locks themselves out", async () => {
    expect((await ws.owner.data<{ twoStepPolicy: { require: string; callerHasTwoStep: boolean } }>(POLICY, { w })).twoStepPolicy).toEqual({ require: 'off', callerHasTwoStep: false });
    expect((await ws.owner.error(SET, { w, r: 'admins' })).message).toMatch(/Set up two-step sign-in for yourself first/);
    expect((await ws.owner.error(SET, { w, r: 'nobody' })).message).toMatch(/off, admins or everyone/);
    // Only people who manage the workspace may change it.
    await turnOnTwoStep(member);
    expect((await member.error(SET, { w, r: 'off' })).code).toBe('FORBIDDEN');
  });

  it('holds back admin rights from admins without it, and nothing else', async () => {
    await turnOnTwoStep(ws.owner);
    expect((await ws.owner.data<{ setTwoStepRequirement: { require: string } }>(SET, { w, r: 'admins' })).setTwoStepRequirement.require).toBe('admins');

    const held = await workspace(admin, w);
    expect(held.twoStepMissing).toBe(true);
    expect(held.permissions).not.toContain('roles.manage');
    expect(held.permissions).not.toContain('members.manage');
    expect(held.permissions).toContain('task.create');
    const invitee = await TestUser.signUp('Two-step invitee');
    const invite = { w, input: { email: invitee.email, roleId: ws.roles.Guest } };
    expect((await admin.error(ADD_MEMBER, invite)).code).toBe('FORBIDDEN');
    expect((await admin.gql(NEW_TASK, { w, l: ws.listId })).errors).toBeUndefined();

    // The owner has it; a plain member loses nothing, so nothing is "missing" for them.
    expect((await workspace(ws.owner, w)).twoStepMissing).toBe(false);
    expect((await workspace(member, w)).twoStepMissing).toBe(false);

    // Setting it up gives the rights back on the next request.
    await turnOnTwoStep(admin);
    expect((await workspace(admin, w)).twoStepMissing).toBe(false);
    expect((await admin.gql(ADD_MEMBER, invite)).errors).toBeUndefined();
  });

  it('holds back everything from anyone without it when required of everyone', async () => {
    const newcomer = await TestUser.signUp('Two-step newcomer');
    await addMember(ws, newcomer, 'Member');
    await ws.owner.data(SET, { w, r: 'everyone' });

    const held = await workspace(newcomer, w);
    expect(held).toEqual({ permissions: [], twoStepMissing: true });
    expect((await newcomer.error(NEW_TASK, { w, l: ws.listId })).code).toBe('FORBIDDEN');
    // They can still open the workspace and read why.
    expect((await newcomer.data<{ twoStepPolicy: { require: string } }>(POLICY, { w })).twoStepPolicy.require).toBe('everyone');

    await turnOnTwoStep(newcomer);
    expect((await newcomer.gql(NEW_TASK, { w, l: ws.listId })).errors).toBeUndefined();

    // Turning two-step off again puts them back on hold at once.
    expect((await newcomer.auth('two-factor/disable', { password: PASSWORD })).status).toBe(200);
    expect((await newcomer.error(NEW_TASK, { w, l: ws.listId })).code).toBe('FORBIDDEN');
  });

  it('is audited, and can be relaxed again', async () => {
    await ws.owner.data(SET, { w, r: 'off' });
    const audit = (await ws.owner.data<{ searchWorkspaceAuditLog: { items: { action: string; metadata: Record<string, unknown> }[] } }>(AUDIT, { w, q: null })).searchWorkspaceAuditLog.items;
    const changes = audit.filter((item) => item.action === 'workspace.two_step.update').map((item) => item.metadata);
    expect(changes).toEqual(expect.arrayContaining([{ from: 'off', to: 'admins' }, { from: 'admins', to: 'everyone' }, { from: 'everyone', to: 'off' }]));
  });
});
