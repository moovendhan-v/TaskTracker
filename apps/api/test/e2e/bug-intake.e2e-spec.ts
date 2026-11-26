import { beforeAll, describe, expect, inject, it } from 'vitest';
import { TestUser } from './support/api-client.js';
import { addMember, createWorkspace, type WorkspaceFixture } from './support/fixtures.js';
import { TEST_ORIGIN } from './support/test-env.js';

const SHOP = 'https://shop.example.com';
const SAVE = 'mutation($w: ID!, $s: ID!, $input: SaveBugIntakeInput!) { saveBugIntake(workspaceId: $w, spaceId: $s, input: $input) { publicKey allowedOrigins widgetEnabled portalEnabled title } }';
const GET = 'query($w: ID!, $s: ID!) { bugIntake(workspaceId: $w, spaceId: $s) { publicKey } }';
const ROTATE = 'mutation($w: ID!, $s: ID!) { rotateBugIntakeKey(workspaceId: $w, spaceId: $s) { publicKey } }';
const SHARE = 'mutation($w: ID!, $t: ID!, $d: Int!) { createBugShare(workspaceId: $w, taskId: $t, days: $d) { path share { id scope } } }';
const SHARES = 'query($w: ID!, $t: ID!) { bugShares(workspaceId: $w, taskId: $t) { id scope createdByName } }';
const REVOKE = 'mutation($w: ID!, $id: ID!) { revokeBugShare(workspaceId: $w, shareId: $id) }';
const PNG = `data:image/png;base64,${Buffer.from('89504e470d0a1a0a0000000d49484452000000010000000108060000001f15c4890000000d4944415478da63f8ffff3f0005fe02fea7d6a5d40000000049454e44ae426082', 'hex').toString('base64')}`;

let ipCounter = 1;
async function call<T>(path: string, init: { body?: unknown; origin?: string } = {}): Promise<{ status: number; body: T; headers: Headers }> {
  const response = await fetch(`${inject('apiUrl')}/api/public/${path}`, {
    method: init.body ? 'POST' : 'GET',
    headers: { 'Content-Type': 'application/json', 'X-Forwarded-For': `10.77.${Math.floor(ipCounter / 250)}.${ipCounter++ % 250}`, ...(init.origin ? { Origin: init.origin } : {}) },
    body: init.body ? JSON.stringify(init.body) : undefined,
  });
  const text = await response.text();
  return { status: response.status, body: (text ? JSON.parse(text) : null) as T, headers: response.headers };
}

describe('Public feedback: widget, portal and report links (E6.3)', () => {
  let ws: WorkspaceFixture;
  let w: string;
  let member: TestUser;
  let key: string;
  let trackingToken: string;
  let reportTaskId: string;

  beforeAll(async () => {
    ws = await createWorkspace('Intake owner');
    w = ws.workspaceId;
    member = await TestUser.signUp('Intake member');
    await addMember(ws, member, 'Member');
  });

  it('is set up by project admins only, and the widget needs its sites listed', async () => {
    expect(await ws.owner.data<{ bugIntake: null }>(GET, { w, s: ws.spaceId })).toEqual({ bugIntake: null });
    expect((await member.error(SAVE, { w, s: ws.spaceId, input: { title: 'Feedback', allowedOrigins: [SHOP], widgetEnabled: true, portalEnabled: true } })).code).toBe('FORBIDDEN');
    expect((await ws.owner.error(SAVE, { w, s: ws.spaceId, input: { title: 'Feedback', allowedOrigins: [], widgetEnabled: true, portalEnabled: false } })).message).toMatch(/Add the site/);
    expect((await ws.owner.error(SAVE, { w, s: ws.spaceId, input: { title: 'Feedback', allowedOrigins: ['http://shop.example.com'], widgetEnabled: true, portalEnabled: false } })).message).toMatch(/https/);
    const saved = (await ws.owner.data<{ saveBugIntake: { publicKey: string; allowedOrigins: string[] } }>(SAVE, {
      w,
      s: ws.spaceId,
      input: { title: 'Acme feedback', allowedOrigins: [`${SHOP}/checkout`, SHOP], widgetEnabled: true, portalEnabled: true },
    })).saveBugIntake;
    expect(saved.publicKey).toMatch(/^tfk_[A-Za-z0-9_-]{32}$/);
    expect(saved.allowedOrigins).toEqual([SHOP]);
    key = saved.publicKey;
  });

  it('serves the public config to anyone, with open CORS and no credentials', async () => {
    const config = await call<{ title: string; widget: boolean; portal: boolean; captchaSiteKey: null }>(`intake/${key}`, { origin: SHOP });
    expect(config.status).toBe(200);
    expect(config.body).toEqual({ title: 'Acme feedback', intro: '', widget: true, portal: true, captchaSiteKey: null });
    expect(config.headers.get('access-control-allow-origin')).toBe('*');
    expect(config.headers.get('access-control-allow-credentials')).toBeNull();
    expect((await call(`intake/tfk_${'x'.repeat(32)}`)).status).toBe(404);
    expect((await call('intake/not-a-key')).status).toBe(404);
  });

  it('files a widget report from a listed site, with diagnostics and a screenshot, redacted', async () => {
    const filed = await call<{ number: number; trackingPath: string }>(`intake/${key}/reports`, {
      origin: SHOP,
      body: {
        via: 'widget',
        kind: 'bug',
        title: 'Coupon field rejects valid codes',
        actual: 'It says the code is invalid',
        expected: 'The discount applies',
        name: 'Pat Customer',
        email: 'pat@example.com',
        context: { pageUrl: `${SHOP}/cart?token=abc123secret`, browser: 'Firefox 133', viewport: '390x844' },
        captureJson: JSON.stringify({ console: [{ level: 'error', message: 'Coupon API failed: apikey=sk_live_1234567890abcdef', at: 2 }], network: [{ method: 'POST', url: `${SHOP}/api/coupon`, status: 422, durationMs: 40, at: 1 }], actions: [] }),
        screenshot: PNG,
      },
    });
    expect(filed.status).toBe(201);
    expect(filed.body.trackingPath).toMatch(/^\/f\/track\/tfs_[A-Za-z0-9_-]{43}$/);
    trackingToken = filed.body.trackingPath.split('/').pop()!;

    const { bugs } = await member.data<{ bugs: { taskId: string; title: string; source: string; reporterName: string; reporterId: string | null; pageUrl: string; consoleErrors: number; failedRequests: number }[] }>(
      'query($w: ID!, $s: ID!) { bugs(workspaceId: $w, spaceId: $s) { taskId title source reporterName reporterId pageUrl consoleErrors failedRequests } }',
      { w, s: ws.spaceId },
    );
    const bug = bugs.find((item) => item.title === 'Coupon field rejects valid codes')!;
    expect(bug).toMatchObject({ source: 'sdk', reporterName: 'Pat Customer', reporterId: null, consoleErrors: 1, failedRequests: 1 });
    expect(bug.pageUrl).not.toContain('abc123secret');
    reportTaskId = bug.taskId;
    const capture = (await member.data<{ bugCapture: string }>('query($w: ID!, $t: ID!) { bugCapture(workspaceId: $w, taskId: $t) }', { w, t: bug.taskId })).bugCapture;
    expect(capture).not.toContain('sk_live_1234567890abcdef');
    const files = (await member.data<{ taskAttachments: { fileName: string; isImage: boolean }[] }>('query($w: ID!, $t: ID!) { taskAttachments(workspaceId: $w, taskId: $t) { fileName isImage } }', { w, t: bug.taskId })).taskAttachments;
    expect(files).toEqual([expect.objectContaining({ fileName: 'screenshot.png', isImage: true })]);
  });

  it('refuses other sites, bots, bad input and switched-off channels', async () => {
    const body = { via: 'widget', title: 'Spam spam spam' };
    expect((await call(`intake/${key}/reports`, { origin: 'https://evil.example.com', body })).status).toBe(403);
    expect((await call(`intake/${key}/reports`, { body })).status).toBe(403);
    expect((await call(`intake/${key}/reports`, { origin: SHOP, body: { ...body, website: 'http://spam.example' } })).status).toBe(400);
    expect((await call(`intake/${key}/reports`, { origin: SHOP, body: { ...body, email: 'not-an-email' } })).status).toBe(400);
    expect((await call(`intake/${key}/reports`, { origin: SHOP, body: { ...body, screenshot: 'data:text/html;base64,PHNjcmlwdD4=' } })).status).toBe(400);
    expect((await call(`intake/${key}/reports`, { origin: SHOP, body: { ...body, extra: 'field' } })).status).toBe(400);
    // The portal posts from TaskFlow itself, not from the shop.
    expect((await call(`intake/${key}/reports`, { origin: SHOP, body: { via: 'portal', title: 'From the wrong place' } })).status).toBe(403);
    const portal = await call<{ number: number }>(`intake/${key}/reports`, { origin: TEST_ORIGIN, body: { via: 'portal', kind: 'feature_request', title: 'Dark mode please', name: 'Lee' } });
    expect(portal.status).toBe(201);

    await ws.owner.data(SAVE, { w, s: ws.spaceId, input: { title: 'Acme feedback', allowedOrigins: [SHOP], widgetEnabled: false, portalEnabled: true } });
    expect((await call(`intake/${key}/reports`, { origin: SHOP, body })).status).toBe(404);
  });

  it('lets the reporter follow their report with a status-only link', async () => {
    const view = await call<Record<string, unknown>>(`shares/${trackingToken}`);
    expect(view.status).toBe(200);
    expect(view.body).toMatchObject({ scope: 'status', title: 'Coupon field rejects valid codes', qaState: 'new', actual: null, capture: null, files: [], pageUrl: null });
    await member.data('mutation($w: ID!, $t: ID!, $s: String!) { setBugQaState(workspaceId: $w, taskId: $t, state: $s) { qaState } }', { w, t: reportTaskId, s: 'confirmed' });
    expect((await call<{ qaState: string }>(`shares/${trackingToken}`)).body.qaState).toBe('confirmed');
    expect((await call(`shares/tfs_${'A'.repeat(43)}`)).status).toBe(404);
  });

  it('shares a full read-only link, lists it, and revoking it closes it', async () => {
    const created = (await member.data<{ createBugShare: { path: string; share: { id: string; scope: string } } }>(SHARE, { w, t: reportTaskId, d: 7 })).createBugShare;
    expect(created.share.scope).toBe('full');
    const token = created.path.split('/').pop()!;
    const view = await call<{ scope: string; actual: string; files: { url: string; isImage: boolean }[]; capture: { console: unknown[] } }>(`shares/${token}`);
    expect(view.body).toMatchObject({ scope: 'full', actual: 'It says the code is invalid' });
    expect(view.body.capture.console).toHaveLength(1);
    // Files come as short-lived signed links.
    expect(view.body.files[0]!.url).toMatch(/^\/api\/storage\/files\//);
    expect((await fetch(inject('apiUrl') + view.body.files[0]!.url)).status).toBe(200);

    expect((await member.error(SHARE, { w, t: reportTaskId, d: 365 })).message).toMatch(/1, 7 or 30/);
    const listed = (await member.data<{ bugShares: { id: string; scope: string; createdByName: string }[] }>(SHARES, { w, t: reportTaskId })).bugShares;
    expect(listed.map((share) => share.scope).sort()).toEqual(['full', 'status']);

    // Another workspace can't revoke or list it.
    const other = await createWorkspace('Intake outsider');
    expect((await other.owner.error(REVOKE, { w: other.workspaceId, id: created.share.id })).code).toBe('NOT_FOUND');
    expect((await member.data<{ revokeBugShare: boolean }>(REVOKE, { w, id: created.share.id })).revokeBugShare).toBe(true);
    expect((await call(`shares/${token}`)).status).toBe(404);

    const actions = (await ws.owner.data<{ workspaceAuditLog: { items: { action: string }[] } }>('query($w: ID!) { workspaceAuditLog(workspaceId: $w) { items { action } } }', { w })).workspaceAuditLog.items.map((item) => item.action);
    expect(actions).toEqual(expect.arrayContaining(['bug_intake.update', 'bug_share.create', 'bug_share.revoke']));
  });

  it('rotates the key: the old one stops working', async () => {
    const rotated = (await ws.owner.data<{ rotateBugIntakeKey: { publicKey: string } }>(ROTATE, { w, s: ws.spaceId })).rotateBugIntakeKey.publicKey;
    expect(rotated).not.toBe(key);
    expect((await call(`intake/${key}`)).status).toBe(404);
    expect((await call(`intake/${rotated}`)).status).toBe(200);
  });
});
