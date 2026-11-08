import { beforeAll, describe, expect, it } from 'vitest';
import { TestUser } from './support/api-client.js';
import { runtimeDatabase, withScope } from './support/database.js';
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

  it('approves a request in one click as a grant that ends, declines others, and revokes early', async () => {
    // Requests are rate limited per person, so this test asks as someone of its own.
    const asker = await TestUser.signUp('Review asker');
    await addMember(ws, asker, 'Member');
    const REQUESTS = 'query($w: ID!) { accessRequests(workspaceId: $w) { id requesterId permission spaceName note status } }';
    const DECIDE = 'mutation($w: ID!, $r: ID!, $a: Boolean!, $d: Int) { decideAccessRequest(workspaceId: $w, requestId: $r, approve: $a, days: $d) { status } }';
    const GRANTS = 'query($w: ID!) { accessGrants(workspaceId: $w) { id userId permission spaceName expiresAt grantedByName } }';
    const REVOKE = 'mutation($w: ID!, $g: ID!) { revokeAccessGrant(workspaceId: $w, grantId: $g) }';
    const DELETE_TASK = 'mutation($w: ID!, $t: ID!) { deleteTask(workspaceId: $w, taskId: $t) }';
    const newTask = async () => (await ws.owner.data<{ createTask: { id: string } }>('mutation($w: ID!, $l: ID!) { createTask(workspaceId: $w, listId: $l, input: { title: "Scratch" }) { id } }', { w, l: ws.listId })).createTask.id;

    await asker.data(REQUEST, { w, input: { permission: 'task.delete', note: 'Cleaning up duplicates' } });
    await asker.data(REQUEST, { w, input: { permission: 'doc.manage' } });
    const pending = (await ws.owner.data<{ accessRequests: { id: string; requesterId: string; permission: string; status: string }[] }>(REQUESTS, { w })).accessRequests;
    const deleteRequest = pending.find((request) => request.permission === 'task.delete')!;
    const docRequest = pending.find((request) => request.permission === 'doc.manage')!;
    expect(deleteRequest).toMatchObject({ requesterId: asker.id, status: 'pending' });
    // Only people who manage roles see or decide requests.
    expect((await asker.error(REQUESTS, { w })).code).toBe('FORBIDDEN');
    expect((await asker.error(DECIDE, { w, r: deleteRequest.id, a: true, d: 7 })).code).toBe('FORBIDDEN');

    // Before: the asker can't delete. Approving needs a valid length, and works once.
    const task = await newTask();
    expect((await asker.error(DELETE_TASK, { w, t: task })).code).toBe('FORBIDDEN');
    expect((await ws.owner.error(DECIDE, { w, r: deleteRequest.id, a: true, d: 365 })).code).toBe('BAD_USER_INPUT');
    expect((await ws.owner.data<{ decideAccessRequest: { status: string } }>(DECIDE, { w, r: deleteRequest.id, a: true, d: 7 })).decideAccessRequest.status).toBe('approved');
    expect((await ws.owner.error(DECIDE, { w, r: deleteRequest.id, a: true, d: 7 })).code).toBe('CONFLICT');
    // After: it works straight away, and the access checker says why.
    expect((await asker.data<{ deleteTask: boolean }>(DELETE_TASK, { w, t: task })).deleteTask).toBe(true);
    const why = (await asker.data<{ explainMyAccess: Explanation }>(MINE, { w, p: 'task.delete' })).explainMyAccess;
    expect(why.allowed).toBe(true);
    expect(why.reasons.map((reason) => reason.source)).toEqual(expect.arrayContaining([expect.stringMatching(/^Temporary access until \d{4}-\d{2}-\d{2}, approved by Review owner$/)]));
    const grants = (await ws.owner.data<{ accessGrants: { id: string; userId: string; permission: string; expiresAt: string }[] }>(GRANTS, { w })).accessGrants;
    const grant = grants.find((item) => item.userId === asker.id && item.permission === 'task.delete')!;
    const days = (new Date(grant.expiresAt).getTime() - Date.now()) / 86_400_000;
    expect(days).toBeGreaterThan(6.9);
    expect(days).toBeLessThanOrEqual(7);

    // Declined: nothing changes, and the requester is told about both.
    expect((await ws.owner.data<{ decideAccessRequest: { status: string } }>(DECIDE, { w, r: docRequest.id, a: false, d: null })).decideAccessRequest.status).toBe('declined');
    const told = (await asker.data<{ notifications: { items: { kind: string; subject: string }[] } }>(INBOX, { w })).notifications.items.filter((item) => item.kind === 'access_decided').map((item) => item.subject);
    expect(told).toEqual(expect.arrayContaining(['task.delete: approved for 7 days', 'doc.manage: declined']));

    // Revoked early: gone at once.
    expect((await ws.owner.data<{ revokeAccessGrant: boolean }>(REVOKE, { w, g: grant.id })).revokeAccessGrant).toBe(true);
    expect((await asker.error(DELETE_TASK, { w, t: await newTask() })).code).toBe('FORBIDDEN');
    const audit = (await ws.owner.data<{ searchWorkspaceAuditLog: { items: { action: string }[] } }>(AUDIT, { w, q: { where: 'action[starts_with]=access.' } })).searchWorkspaceAuditLog.items.map((item) => item.action);
    expect(audit).toEqual(expect.arrayContaining(['access.grant', 'access.request.decline', 'access.grant.revoke']));

    // Row-level security: nobody writes a grant for themselves, even straight in SQL.
    const pool = runtimeDatabase();
    try {
      await expect(
        withScope(pool, { workspaceId: w, userId: asker.id }, (client) =>
          client.query(`INSERT INTO access_grant (workspace_id, user_id, permission, expires_at, granted_by) VALUES ($1, $2, 'task.delete', now() + interval '1 day', $2)`, [w, asker.id]),
        ),
      ).rejects.toThrow(/row-level security/);
    } finally {
      await pool.end();
    }
  });

  it('only hands out access the approver has, and never to themselves', async () => {
    const third = await TestUser.signUp('Review third');
    await addMember(ws, third, 'Member');
    const DECIDE = 'mutation($w: ID!, $r: ID!, $a: Boolean!, $d: Int) { decideAccessRequest(workspaceId: $w, requestId: $r, approve: $a, days: $d) { status } }';
    const REQUESTS = 'query($w: ID!) { accessRequests(workspaceId: $w) { id requesterId permission } }';
    // Admins manage roles but can't manage the workspace itself (their role denies it).
    const admin = await TestUser.signUp('Review admin');
    await addMember(ws, admin, 'Admin');
    await third.data(REQUEST, { w, input: { permission: 'workspace.manage' } });
    await admin.data(REQUEST, { w, input: { permission: 'workspace.manage' } });
    const pending = (await ws.owner.data<{ accessRequests: { id: string; requesterId: string; permission: string }[] }>(REQUESTS, { w })).accessRequests.filter((request) => request.permission === 'workspace.manage');
    const fromMember = pending.find((request) => request.requesterId === third.id)!;
    const fromAdmin = pending.find((request) => request.requesterId === admin.id)!;
    expect((await admin.error(DECIDE, { w, r: fromMember.id, a: true, d: 1 })).message).toMatch(/only hand out access you have/);
    expect((await admin.error(DECIDE, { w, r: fromAdmin.id, a: true, d: 1 })).message).toMatch(/Someone else has to decide your own request/);
    // Approved by the owner, a grant still loses to the admin role's deny.
    await ws.owner.data(DECIDE, { w, r: fromAdmin.id, a: true, d: 1 });
    const why = (await admin.data<{ explainMyAccess: Explanation }>(MINE, { w, p: 'workspace.manage' })).explainMyAccess;
    expect(why).toMatchObject({ allowed: false, verdict: 'denied' });
    expect((await admin.error('mutation($w: ID!) { updateWorkspace(workspaceId: $w, input: { name: "Renamed" }) { id } }', { w })).code).toBe('FORBIDDEN');
  });
});
