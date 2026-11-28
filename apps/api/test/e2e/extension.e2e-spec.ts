import { createHash, randomBytes } from 'node:crypto';
import { beforeAll, describe, expect, inject, it } from 'vitest';
import { TestUser } from './support/api-client.js';
import { addMember, createWorkspace, type WorkspaceFixture } from './support/fixtures.js';

const API = () => `${inject('apiUrl')}/api/extension`;
const APPROVE = 'mutation($w: ID!, $c: String!, $n: String!) { approveExtensionConnection(workspaceId: $w, challenge: $c, name: $n) { id name pending scopes } }';
const TOKENS = 'query($w: ID!) { apiTokens(workspaceId: $w) { id name pending prefix lastUsedAt } }';
const REVOKE = 'mutation($w: ID!, $t: ID!) { revokeApiToken(workspaceId: $w, tokenId: $t) }';
const AUDIT = 'query($w: ID!) { workspaceAuditLog(workspaceId: $w) { items { action } } }';

const PNG = Buffer.from('89504e470d0a1a0a0000000d49484452000000010000000108060000001f15c4890000000d4944415478da63f8ffff3f0005fe02fea7d6a5d40000000049454e44ae426082', 'hex');

/** What the extension does: a random verifier, and its S256 challenge for the approval link. */
function pkce() {
  const verifier = randomBytes(32).toString('base64url');
  return { verifier, challenge: createHash('sha256').update(verifier).digest('base64url') };
}

async function call<T>(path: string, init: { method?: string; token?: string; body?: unknown } = {}): Promise<{ status: number; body: T }> {
  const response = await fetch(`${API()}/${path}`, {
    method: init.method ?? (init.body ? 'POST' : 'GET'),
    headers: { 'Content-Type': 'application/json', 'X-Forwarded-For': `10.9.${Math.floor(Math.random() * 250)}.${Math.floor(Math.random() * 250)}`, ...(init.token ? { Authorization: `Bearer ${init.token}` } : {}) },
    body: init.body ? JSON.stringify(init.body) : undefined,
  });
  const text = await response.text();
  return { status: response.status, body: (text ? JSON.parse(text) : null) as T };
}

async function connect(user: TestUser, w: string, name = 'Chrome on my laptop'): Promise<{ token: string; id: string }> {
  const { verifier, challenge } = pkce();
  expect((await call<{ status: string }>('token', { body: { verifier } })).body).toEqual({ status: 'pending' });
  const approved = (await user.data<{ approveExtensionConnection: { id: string; pending: boolean } }>(APPROVE, { w, c: challenge, n: name })).approveExtensionConnection;
  expect(approved.pending).toBe(true);
  const picked = await call<{ status: string; token: string }>('token', { body: { verifier } });
  expect(picked.body.status).toBe('connected');
  expect(picked.body.token).toMatch(/^tfx_/);
  // Single use: the same verifier gets nothing a second time.
  expect((await call<{ status: string }>('token', { body: { verifier } })).body).toEqual({ status: 'pending' });
  return { token: picked.body.token, id: approved.id };
}

describe('Browser extension connection (E6.3)', () => {
  let ws: WorkspaceFixture;
  let w: string;
  let member: TestUser;
  let token: string;
  let tokenId: string;

  beforeAll(async () => {
    ws = await createWorkspace('Extension owner');
    w = ws.workspaceId;
    member = await TestUser.signUp('Extension member');
    await addMember(ws, member, 'Member');
    ({ token, id: tokenId } = await connect(member, w));
  });

  it('connects with PKCE: only the verifier holder gets the token, once', async () => {
    const tokens = (await member.data<{ apiTokens: { id: string; pending: boolean; prefix: string }[] }>(TOKENS, { w })).apiTokens;
    expect(tokens).toEqual([expect.objectContaining({ id: tokenId, pending: false, prefix: token.slice(0, 8) })]);
    // The approval link carries only the challenge: sending it as the verifier gets nothing.
    const { challenge } = pkce();
    await member.data(APPROVE, { w, c: challenge, n: 'Other browser' });
    expect((await call<{ status: string }>('token', { body: { verifier: `${challenge}${'x'.repeat(5)}` } })).body).toEqual({ status: 'pending' });
    expect((await member.error(APPROVE, { w, c: 'not-a-challenge', n: 'x' })).message).toMatch(/not valid/);
    // Someone else never sees this person's connections.
    expect((await ws.owner.data<{ apiTokens: unknown[] }>(TOKENS, { w })).apiTokens).toEqual([]);
  });

  it('tells the extension who it is and which projects it can file into', async () => {
    const { status, body } = await call<{ user: { email: string }; workspace: { id: string }; projects: { id: string }[]; scopes: string[] }>('session', { token });
    expect(status).toBe(200);
    expect(body.user.email).toBe(member.email);
    expect(body.workspace.id).toBe(w);
    expect(body.projects.map((project) => project.id)).toContain(ws.spaceId);
    expect(body.scopes).toEqual(['bugs:read', 'bugs:write']);
    expect((await call('session')).status).toBe(401);
    expect((await call('session', { token: 'tfx_' + 'A'.repeat(43) })).status).toBe(401);
    expect((await call('session', { token: 'garbage' })).status).toBe(401);
  });

  it('files a report with diagnostics and a screenshot, marked as from the extension', async () => {
    const filed = await call<{ taskId: string; number: number; source: string; consoleErrors: number; url: string }>('bugs', {
      token,
      body: {
        spaceId: ws.spaceId,
        title: 'Pricing page total is wrong',
        severity: 'P2',
        environment: 'production',
        expected: '€90',
        actual: '€900',
        context: { pageUrl: 'https://shop.example.com/pricing?session=secret123', browser: 'Chrome 132', viewport: '1280x720' },
        captureJson: JSON.stringify({ console: [{ level: 'error', message: 'NaN total', at: 5 }], network: [], actions: [] }),
      },
    });
    expect(filed.status).toBe(201);
    expect(filed.body).toMatchObject({ source: 'extension', consoleErrors: 1 });
    expect(filed.body.url).toBe(`/w/${w}/p/${ws.spaceId}/bugs?task=${filed.body.taskId}`);

    const ticket = await call<{ attachmentId: string; uploadUrl: string }>(`bugs/${filed.body.taskId}/uploads`, { token, body: { fileName: 'screenshot.png', size: PNG.length } });
    expect(ticket.status).toBe(201);
    expect((await fetch(inject('apiUrl') + ticket.body.uploadUrl, { method: 'PUT', body: PNG })).status).toBe(204);
    const done = await call<{ attachment: { fileName: string } | null; error: string | null }>(`uploads/${ticket.body.attachmentId}/complete`, { token, body: {} });
    expect(done.body).toMatchObject({ attachment: { fileName: 'screenshot.png' }, error: null });

    // The member sees it like any other report; the page address lost its secret.
    const { bug } = await member.data<{ bug: { source: string; pageUrl: string; reporterId: string } }>('query($w: ID!, $t: ID!) { bug(workspaceId: $w, taskId: $t) { source pageUrl reporterId } }', { w, t: filed.body.taskId });
    expect(bug).toMatchObject({ source: 'extension', reporterId: member.id });
    expect(bug.pageUrl).not.toContain('secret123');

    const similar = await call<{ title: string }[]>(`bugs/similar?spaceId=${ws.spaceId}&title=${encodeURIComponent('Pricing page total wrong')}`, { token });
    expect(similar.body.map((item) => item.title)).toContain('Pricing page total is wrong');

    // Files only onto bug reports, not onto any task the token can see.
    const plain = (await member.data<{ createTask: { id: string } }>('mutation($w: ID!, $l: ID!) { createTask(workspaceId: $w, listId: $l, input: { title: "Plain task" }) { id } }', { w, l: ws.listId })).createTask.id;
    expect((await call(`bugs/${plain}/uploads`, { token, body: { fileName: 'x.png', size: 10 } })).status).toBe(404);
  });

  it("can't reach another workspace, and follows the owner's current role", async () => {
    const other = await createWorkspace('Extension outsider');
    expect((await call(`bugs`, { token, body: { spaceId: other.spaceId, title: 'Sneaky report' } })).status).toBeGreaterThanOrEqual(400);
    expect((await call(`bugs/similar?spaceId=${other.spaceId}&title=Sneaky`, { token })).body).toEqual([]);

    // Removed from the workspace: the token stops working at once.
    const leaver = await TestUser.signUp('Extension leaver');
    await addMember(ws, leaver, 'Member');
    const { token: leaverToken } = await connect(leaver, w, 'Leaver browser');
    expect((await call('session', { token: leaverToken })).status).toBe(200);
    await ws.owner.data('mutation($w: ID!, $u: ID!) { removeMember(workspaceId: $w, userId: $u) }', { w, u: leaver.id });
    expect((await call('session', { token: leaverToken })).status).toBe(401);
  });

  it('revokes from TaskFlow or from the extension, and audits it', async () => {
    expect((await member.data<{ revokeApiToken: boolean }>(REVOKE, { w, t: tokenId })).revokeApiToken).toBe(true);
    expect((await call('session', { token })).status).toBe(401);
    expect((await member.error(REVOKE, { w, t: tokenId })).code).toBe('NOT_FOUND');

    const { token: second } = await connect(member, w, 'Firefox');
    expect((await call('disconnect', { token: second, body: {} })).status).toBe(204);
    expect((await call('session', { token: second })).status).toBe(401);

    const actions = (await ws.owner.data<{ workspaceAuditLog: { items: { action: string }[] } }>(AUDIT, { w })).workspaceAuditLog.items.map((item) => item.action);
    expect(actions).toEqual(expect.arrayContaining(['api_token.approve', 'api_token.issue', 'api_token.revoke']));
  });
});
