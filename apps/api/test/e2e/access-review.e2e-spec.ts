import { beforeAll, describe, expect, it } from 'vitest';
import { TestUser } from './support/api-client.js';
import { addMember, createWorkspace, type WorkspaceFixture } from './support/fixtures.js';

const EXPLAIN = 'query($w: ID!, $u: ID!, $p: String!, $s: ID) { explainAccess(workspaceId: $w, userId: $u, permission: $p, spaceId: $s) { userId roleName permission spaceId allowed verdict reasons { effect source pattern scope } } }';
const MINE = 'query($w: ID!, $p: String!, $s: ID) { explainMyAccess(workspaceId: $w, permission: $p, spaceId: $s) { allowed verdict roleName reasons { effect source pattern } } }';
const REQUEST = 'mutation($w: ID!, $input: RequestAccessInput!) { requestAccess(workspaceId: $w, input: $input) }';
const INBOX = 'query($w: ID!) { notifications(workspaceId: $w) { items { kind subject excerpt actorId } } }';
const AUDIT = 'query($w: ID!, $q: ResourceQueryInput) { searchWorkspaceAuditLog(workspaceId: $w, query: $q) { items { action } } }';

interface Explanation {
  allowed: boolean;
  verdict: string;
  roleName: string;
  reasons: { effect: string; source: string; pattern: string; scope?: string }[];
}

/** E3: the access checker (explain any member's access) and access requests. */
describe('access review', () => {
  let ws: WorkspaceFixture;
  let member: TestUser;
  let w: string;

  beforeAll(async () => {
    ws = await createWorkspace('Review owner');
    w = ws.workspaceId;
    member = await TestUser.signUp('Review member');
    await addMember(ws, member, 'Member');
  });

  it('explains a member’s access, naming the statement that decides', async () => {
    const update = (await ws.owner.data<{ explainAccess: Explanation }>(EXPLAIN, { w, u: member.id, p: 'task.update', s: ws.spaceId })).explainAccess;
    expect(update).toMatchObject({ allowed: true, verdict: 'allowed', roleName: 'Member' });
    expect(update.reasons).toContainEqual(expect.objectContaining({ effect: 'allow', pattern: 'task.update', source: expect.stringMatching(/Contributor/) }));
    const roles = (await ws.owner.data<{ explainAccess: Explanation }>(EXPLAIN, { w, u: member.id, p: 'roles.manage', s: null })).explainAccess;
    expect(roles).toMatchObject({ allowed: false, verdict: 'not-granted', reasons: [] });
    // Owners are explained too, and unknown permissions or people are refused.
    expect((await ws.owner.data<{ explainAccess: Explanation }>(EXPLAIN, { w, u: ws.owner.id, p: 'workspace.manage', s: null })).explainAccess.allowed).toBe(true);
    expect((await ws.owner.error(EXPLAIN, { w, u: member.id, p: 'root.everything', s: null })).message).toMatch(/Unknown permission/);
    const stranger = await TestUser.signUp('Review stranger');
    expect((await ws.owner.error(EXPLAIN, { w, u: stranger.id, p: 'task.view', s: null })).code).toBe('NOT_FOUND');
  });

  it('lets only role managers check others, and anyone check themselves', async () => {
    expect((await member.error(EXPLAIN, { w, u: ws.owner.id, p: 'task.view', s: null })).code).toBe('FORBIDDEN');
    const mine = (await member.data<{ explainMyAccess: Explanation }>(MINE, { w, p: 'roles.manage', s: null })).explainMyAccess;
    expect(mine).toMatchObject({ allowed: false, verdict: 'not-granted', roleName: 'Member' });
  });

  it('asks role managers for access, audited, and only for access you lack', async () => {
    const asked = (await member.data<{ requestAccess: number }>(REQUEST, { w, input: { permission: 'automation.manage', spaceId: ws.spaceId, note: 'To set up triage rules' } })).requestAccess;
    expect(asked).toBe(1);
    const inbox = (await ws.owner.data<{ notifications: { items: { kind: string; subject: string; excerpt: string; actorId: string }[] } }>(INBOX, { w })).notifications.items;
    expect(inbox).toContainEqual({ kind: 'access_requested', subject: expect.stringMatching(/^automation\.manage in /), excerpt: 'To set up triage rules', actorId: member.id });
    const audit = (await ws.owner.data<{ searchWorkspaceAuditLog: { items: { action: string }[] } }>(AUDIT, { w, q: { where: 'action=access.request' } })).searchWorkspaceAuditLog.items;
    expect(audit.length).toBeGreaterThan(0);
    expect((await member.error(REQUEST, { w, input: { permission: 'task.view' } })).message).toMatch(/already have/);
    expect((await member.error(REQUEST, { w, input: { permission: 'everything' } })).message).toMatch(/Unknown permission/);
  });
});
