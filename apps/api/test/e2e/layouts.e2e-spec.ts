import { describe, expect, it } from 'vitest';
import { TestUser } from './support/api-client.js';
import { addMember, createWorkspace } from './support/fixtures.js';

const GET = 'query($w: ID!, $p: String!) { myLayout(workspaceId: $w, pageKey: $p) { pageKey version items { id type x y w h } } }';
const SAVE = 'mutation($w: ID!, $input: SaveLayoutInput!) { saveLayout(workspaceId: $w, input: $input) { version items { id x y w h } } }';
const RESET = 'mutation($w: ID!, $p: String!) { resetLayout(workspaceId: $w, pageKey: $p) }';
const items = [
  { id: 'status', type: 'status', x: 0, y: 0, w: 6, h: 4 },
  { id: 'priority', type: 'priority', x: 6, y: 0, w: 6, h: 4 },
];

describe('dashboard layouts', () => {
  it('saves a personal layout with optimistic versioning', async () => {
    const ws = await createWorkspace('Layout owner');
    const w = ws.workspaceId;
    expect((await ws.owner.data<{ myLayout: unknown }>(GET, { w, p: 'home' })).myLayout).toBeNull();

    const first = await ws.owner.data<{ saveLayout: { version: number } }>(SAVE, { w, input: { pageKey: 'home', baseVersion: null, items } });
    expect(first.saveLayout.version).toBe(1);
    const second = await ws.owner.data<{ saveLayout: { version: number } }>(SAVE, { w, input: { pageKey: 'home', baseVersion: 1, items: items.slice(0, 1) } });
    expect(second.saveLayout.version).toBe(2);

    // A save based on an old version (another device) is refused, and nothing changes.
    expect((await ws.owner.error(SAVE, { w, input: { pageKey: 'home', baseVersion: 1, items } })).code).toBe('CONFLICT');
    expect((await ws.owner.error(SAVE, { w, input: { pageKey: 'home', baseVersion: null, items } })).code).toBe('CONFLICT');
    const { myLayout } = await ws.owner.data<{ myLayout: { version: number; items: unknown[] } }>(GET, { w, p: 'home' });
    expect(myLayout).toMatchObject({ version: 2, items: [{ id: 'status', type: 'status', x: 0, y: 0, w: 6, h: 4 }] });

    expect((await ws.owner.data<{ resetLayout: boolean }>(RESET, { w, p: 'home' })).resetLayout).toBe(true);
    expect((await ws.owner.data<{ myLayout: unknown }>(GET, { w, p: 'home' })).myLayout).toBeNull();
  });

  it('rejects layouts that break the grid rules', async () => {
    const ws = await createWorkspace('Layout rules');
    const save = (input: Record<string, unknown>) => ws.owner.error(SAVE, { w: ws.workspaceId, input: { pageKey: 'home', baseVersion: null, ...input } });
    expect((await save({ items: [{ ...items[0], type: 'shell-exec' }] })).message).toMatch(/unknown block type/);
    expect((await save({ items: [items[0], { ...items[1], x: 3 }] })).message).toMatch(/overlap/);
    expect((await save({ items: [{ ...items[0], x: 10 }] })).message).toMatch(/outside the grid/);
    expect((await save({ pageKey: 'admin', items })).code).toBe('BAD_USER_INPUT');
    expect((await ws.owner.error(GET, { w: ws.workspaceId, p: 'nope' })).code).toBe('BAD_USER_INPUT');
  });

  it('keeps each person’s layout to themselves, and needs workspace access', async () => {
    const ws = await createWorkspace('Layout privacy');
    const w = ws.workspaceId;
    const member = await TestUser.signUp('Layout member');
    await addMember(ws, member, 'Member');
    await ws.owner.data(SAVE, { w, input: { pageKey: 'home', baseVersion: null, items } });

    // Same workspace, different person: sees only their own (none), and saving creates their own row.
    expect((await member.data<{ myLayout: unknown }>(GET, { w, p: 'home' })).myLayout).toBeNull();
    await member.data(SAVE, { w, input: { pageKey: 'home', baseVersion: null, items: items.slice(1) } });
    expect((await ws.owner.data<{ myLayout: { items: unknown[] } }>(GET, { w, p: 'home' })).myLayout.items).toHaveLength(2);
    await member.data(RESET, { w, p: 'home' });
    expect((await ws.owner.data<{ myLayout: { items: unknown[] } }>(GET, { w, p: 'home' })).myLayout.items).toHaveLength(2);

    // Outside the workspace: refused.
    const outsider = await TestUser.signUp('Layout outsider');
    expect((await outsider.error(GET, { w, p: 'home' })).code).toMatch(/FORBIDDEN|NOT_FOUND/);
    expect((await outsider.error(SAVE, { w, input: { pageKey: 'home', baseVersion: null, items } })).code).toMatch(/FORBIDDEN|NOT_FOUND/);
  });

  it('keeps the project dashboard layout separate, with its own blocks', async () => {
    const ws = await createWorkspace('Project layout');
    const w = ws.workspaceId;
    const projectItems = [
      { id: 'phases', type: 'phases', x: 0, y: 0, w: 12, h: 7 },
      { id: 'kpis', type: 'kpis', x: 0, y: 7, w: 12, h: 3 },
    ];
    const saved = (await ws.owner.data<{ saveLayout: { version: number } }>(SAVE, { w, input: { pageKey: 'project', baseVersion: null, items: projectItems } })).saveLayout;
    expect(saved.version).toBe(1);
    expect((await ws.owner.data<{ myLayout: { items: { type: string }[] } }>(GET, { w, p: 'project' })).myLayout.items.map((item) => item.type)).toEqual(['phases', 'kpis']);
    // Home has its own layout, and the two pages don't share block types.
    expect((await ws.owner.data<{ myLayout: unknown }>(GET, { w, p: 'home' })).myLayout).toBeNull();
    expect((await ws.owner.error(SAVE, { w, input: { pageKey: 'project', baseVersion: 1, items: [{ id: 'status', type: 'status', x: 0, y: 0, w: 4, h: 5 }] } })).message).toMatch(/unknown block type/);
    expect((await ws.owner.error(SAVE, { w, input: { pageKey: 'home', baseVersion: null, items: projectItems } })).message).toMatch(/unknown block type/);
  });

  it('stores block settings, data source apart from view, and checks them per block', async () => {
    const ws = await createWorkspace('Block settings');
    const w = ws.workspaceId;
    const GET_CONFIG = 'query($w: ID!, $p: String!) { myLayout(workspaceId: $w, pageKey: $p) { items { id config { title accent spaceId limit includeClosed } } } }';
    const items = [
      { id: 'status', type: 'status', x: 0, y: 0, w: 4, h: 5, config: { title: 'Engineering status', accent: 'blue', spaceId: ws.spaceId, includeClosed: true } },
      { id: 'overdue-tasks', type: 'overdue-tasks', x: 4, y: 0, w: 4, h: 7, config: { limit: 5 } },
      { id: 'priority', type: 'priority', x: 8, y: 0, w: 4, h: 5, config: {} },
    ];
    await ws.owner.data(SAVE, { w, input: { pageKey: 'home', baseVersion: null, items } });
    const stored = (await ws.owner.data<{ myLayout: { items: { id: string; config: Record<string, unknown> | null }[] } }>(GET_CONFIG, { w, p: 'home' })).myLayout.items;
    expect(stored.map((item) => [item.id, item.config])).toEqual([
      ['status', { title: 'Engineering status', accent: 'blue', spaceId: ws.spaceId, limit: null, includeClosed: true }],
      ['overdue-tasks', { title: null, accent: null, spaceId: null, limit: 5, includeClosed: null }],
      ['priority', null],
    ]);
    // Settings a block doesn't have, and bad values, are refused.
    const bad = (config: Record<string, unknown>, type = 'priority') => ws.owner.error(SAVE, { w, input: { pageKey: 'home', baseVersion: 1, items: [{ id: type, type, x: 0, y: 0, w: 4, h: 5, config }] } });
    expect((await bad({ limit: 5 })).message).toMatch(/limit isn't a setting of this block/);
    expect((await bad({ includeClosed: true })).message).toMatch(/includeClosed isn't a setting/);
    expect((await bad({ accent: 'neon' })).code).toBe('BAD_USER_INPUT');
    expect((await bad({ limit: 7 }, 'overdue-tasks')).code).toBe('BAD_USER_INPUT');
    expect((await bad({ title: 'x'.repeat(61) })).code).toBe('BAD_USER_INPUT');
    // A project dashboard follows its page's project: no data source setting there.
    expect((await ws.owner.error(SAVE, { w, input: { pageKey: 'project', baseVersion: null, items: [{ id: 'kpis', type: 'kpis', x: 0, y: 0, w: 12, h: 4, config: { spaceId: ws.spaceId } }] } })).message).toMatch(/spaceId isn't a setting/);
  });

  it('keeps your recent saves to go back to, and only yours', async () => {
    const ws = await createWorkspace('Layout history');
    const w = ws.workspaceId;
    const member = await TestUser.signUp('Layout history member');
    await addMember(ws, member, 'Member');
    const VERSIONS = 'query($w: ID!, $p: String!) { myLayoutVersions(workspaceId: $w, pageKey: $p) { version items { id } } }';
    const one = (id: string) => [{ id, type: id, x: 0, y: 0, w: 4, h: 5 }];
    await ws.owner.data(SAVE, { w, input: { pageKey: 'home', baseVersion: null, items: one('status') } });
    await ws.owner.data(SAVE, { w, input: { pageKey: 'home', baseVersion: 1, items: one('priority') } });
    const versions = (await ws.owner.data<{ myLayoutVersions: { version: number; items: { id: string }[] }[] }>(VERSIONS, { w, p: 'home' })).myLayoutVersions;
    expect(versions.map((v) => [v.version, v.items[0]!.id])).toEqual([
      [2, 'priority'],
      [1, 'status'],
    ]);
    expect((await member.data<{ myLayoutVersions: unknown[] }>(VERSIONS, { w, p: 'home' })).myLayoutVersions).toEqual([]);
    // Only the newest 20 are kept.
    for (let version = 2; version < 25; version++) await ws.owner.data(SAVE, { w, input: { pageKey: 'home', baseVersion: version, items: one(version % 2 ? 'status' : 'priority') } });
    expect((await ws.owner.data<{ myLayoutVersions: unknown[] }>(VERSIONS, { w, p: 'home' })).myLayoutVersions).toHaveLength(20);
  });

  it('lets layout managers set the workspace default, audited, and nobody else', async () => {
    const ws = await createWorkspace('Layout default');
    const w = ws.workspaceId;
    const member = await TestUser.signUp('Layout default member');
    const admin = await TestUser.signUp('Layout default admin');
    await addMember(ws, member, 'Member');
    await addMember(ws, admin, 'Admin');
    const DEFAULT = 'query($w: ID!, $p: String!) { workspaceLayout(workspaceId: $w, pageKey: $p) { items { id } updatedByName } }';
    const SET = 'mutation($w: ID!, $input: SetWorkspaceLayoutInput!) { setWorkspaceLayout(workspaceId: $w, input: $input) { items { id } } }';
    const CLEAR = 'mutation($w: ID!, $p: String!) { clearWorkspaceLayout(workspaceId: $w, pageKey: $p) }';
    const items = [{ id: 'workload', type: 'workload', x: 0, y: 0, w: 6, h: 7 }];
    expect((await member.data<{ workspaceLayout: unknown }>(DEFAULT, { w, p: 'home' })).workspaceLayout).toBeNull();
    expect((await member.error(SET, { w, input: { pageKey: 'home', items } })).code).toBe('FORBIDDEN');
    await admin.data(SET, { w, input: { pageKey: 'home', items } });
    expect((await member.data<{ workspaceLayout: { items: { id: string }[]; updatedByName: string } }>(DEFAULT, { w, p: 'home' })).workspaceLayout).toEqual({
      items: [{ id: 'workload' }],
      updatedByName: 'Layout default admin',
    });
    expect((await admin.error(SET, { w, input: { pageKey: 'home', items: [{ ...items[0]!, type: 'phases' }] } })).message).toMatch(/unknown block type/);
    // Another workspace never sees it.
    const other = await createWorkspace('Layout default other');
    expect((await other.owner.data<{ workspaceLayout: unknown }>(DEFAULT, { w: other.workspaceId, p: 'home' })).workspaceLayout).toBeNull();
    expect((await member.error(CLEAR, { w, p: 'home' })).code).toBe('FORBIDDEN');
    expect((await admin.data<{ clearWorkspaceLayout: boolean }>(CLEAR, { w, p: 'home' })).clearWorkspaceLayout).toBe(true);
    const audit = (await ws.owner.data<{ workspaceAuditLog: { items: { action: string }[] } }>('query($w: ID!) { workspaceAuditLog(workspaceId: $w) { items { action } } }', { w })).workspaceAuditLog.items.map((entry) => entry.action);
    expect(audit).toEqual(expect.arrayContaining(['layout.default.set', 'layout.default.clear']));
  });

  it('pins single blocks for everyone: put back as set in other people’s layouts', async () => {
    const ws = await createWorkspace('Layout pins');
    const w = ws.workspaceId;
    const member = await TestUser.signUp('Layout pins member');
    await addMember(ws, member, 'Member');
    const SET = 'mutation($w: ID!, $input: SetWorkspaceLayoutInput!) { setWorkspaceLayout(workspaceId: $w, input: $input) { items { id pinned } } }';
    const MINE = 'query($w: ID!, $p: String!) { myLayout(workspaceId: $w, pageKey: $p) { version items { id x y w h pinned } } }';
    const SAVE_PINNED = 'mutation($w: ID!, $input: SaveLayoutInput!) { saveLayout(workspaceId: $w, input: $input) { version items { id x y w h pinned } } }';
    const announcement = { id: 'status', type: 'status', x: 0, y: 0, w: 12, h: 4, pinned: true };
    expect((await member.error(SET, { w, input: { pageKey: 'home', items: [announcement] } })).code).toBe('FORBIDDEN');
    await ws.owner.data(SET, { w, input: { pageKey: 'home', items: [announcement, { id: 'priority', type: 'priority', x: 0, y: 4, w: 6, h: 5 }] } });

    // The member drops the pinned block, puts their own on its spot and tries to pin it.
    const saved = (await member.data<{ saveLayout: { items: Record<string, unknown>[] } }>(SAVE_PINNED, { w, input: { pageKey: 'home', baseVersion: null, items: [{ id: 'workload', type: 'workload', x: 0, y: 0, w: 6, h: 6, pinned: true }] } })).saveLayout.items;
    expect(saved).toEqual([
      { id: 'status', x: 0, y: 0, w: 12, h: 4, pinned: true },
      { id: 'workload', x: 0, y: 4, w: 6, h: 6, pinned: null },
    ]);
    // Moving or resizing it doesn't stick either.
    const moved = (await member.data<{ saveLayout: { items: Record<string, unknown>[] } }>(SAVE_PINNED, { w, input: { pageKey: 'home', baseVersion: 1, items: [{ ...announcement, x: 6, y: 10, w: 6, pinned: false }, { id: 'workload', type: 'workload', x: 0, y: 0, w: 6, h: 6 }] } })).saveLayout.items;
    expect(moved[0]).toEqual({ id: 'status', x: 0, y: 0, w: 12, h: 4, pinned: true });

    // Unpinning in the default frees it on their next read: their copy stays, unpinned.
    await ws.owner.data(SET, { w, input: { pageKey: 'home', items: [{ ...announcement, pinned: false }] } });
    const mine = (await member.data<{ myLayout: { items: { id: string; pinned: boolean | null }[] } }>(MINE, { w, p: 'home' })).myLayout.items;
    expect(mine.map((item) => [item.id, item.pinned])).toEqual([
      ['status', null],
      ['workload', null],
    ]);
    // Layout managers draft pins in their own layout freely; nothing is put back for them.
    const draft = (await ws.owner.data<{ saveLayout: { items: Record<string, unknown>[] } }>(SAVE_PINNED, { w, input: { pageKey: 'home', baseVersion: null, items: [{ id: 'workload', type: 'workload', x: 0, y: 0, w: 6, h: 6, pinned: true }] } })).saveLayout.items;
    expect(draft).toEqual([{ id: 'workload', x: 0, y: 0, w: 6, h: 6, pinned: true }]);
  });

  it('locks a workspace layout: everyone sees it, only layout managers arrange the page', async () => {
    const ws = await createWorkspace('Layout lock');
    const w = ws.workspaceId;
    const member = await TestUser.signUp('Layout lock member');
    await addMember(ws, member, 'Member');
    const SET = 'mutation($w: ID!, $input: SetWorkspaceLayoutInput!) { setWorkspaceLayout(workspaceId: $w, input: $input) { locked } }';
    const LOCK = 'mutation($w: ID!, $p: String!, $l: Boolean!) { setWorkspaceLayoutLocked(workspaceId: $w, pageKey: $p, locked: $l) { locked } }';
    const DEFAULT = 'query($w: ID!, $p: String!) { workspaceLayout(workspaceId: $w, pageKey: $p) { locked items { id } } }';
    const mine = { pageKey: 'home', baseVersion: null, items: [items[0]] };

    // Nothing to lock yet.
    expect((await ws.owner.error(LOCK, { w, p: 'home', l: true })).message).toMatch(/Make a workspace default/);
    await member.data(SAVE, { w, input: mine });
    expect((await ws.owner.data<{ setWorkspaceLayout: { locked: boolean } }>(SET, { w, input: { pageKey: 'home', items } })).setWorkspaceLayout.locked).toBe(false);
    expect((await member.error(LOCK, { w, p: 'home', l: true })).code).toBe('FORBIDDEN');
    expect((await ws.owner.data<{ setWorkspaceLayoutLocked: { locked: boolean } }>(LOCK, { w, p: 'home', l: true })).setWorkspaceLayoutLocked.locked).toBe(true);

    // The member's own layout steps aside, and saving is refused on the server.
    expect((await member.data<{ myLayout: unknown }>(GET, { w, p: 'home' })).myLayout).toBeNull();
    expect((await member.data<{ workspaceLayout: { locked: boolean; items: unknown[] } }>(DEFAULT, { w, p: 'home' })).workspaceLayout).toMatchObject({ locked: true, items: [{ id: 'status' }, { id: 'priority' }] });
    expect((await member.error(SAVE, { w, input: { ...mine, baseVersion: 1 } })).message).toMatch(/locked/);
    // Re-publishing keeps the lock; the owner still arranges their own.
    expect((await ws.owner.data<{ setWorkspaceLayout: { locked: boolean } }>(SET, { w, input: { pageKey: 'home', items } })).setWorkspaceLayout.locked).toBe(true);
    await ws.owner.data(SAVE, { w, input: mine });

    // Unlocked, the member's own layout is back.
    await ws.owner.data(LOCK, { w, p: 'home', l: false });
    expect((await member.data<{ myLayout: { items: unknown[] } }>(GET, { w, p: 'home' })).myLayout.items).toHaveLength(1);
  });

  it('stores sections and stacked tabs, checked by the layout rules', async () => {
    const ws = await createWorkspace('Layout stacks');
    const w = ws.workspaceId;
    const READ = 'query($w: ID!, $p: String!) { myLayout(workspaceId: $w, pageKey: $p) { items { id type h tabs config { title } } } }';
    const layout = [
      { id: 'section-1', type: 'section', x: 0, y: 0, w: 12, h: 1, config: { title: 'This week' } },
      { id: 'priority', type: 'priority', x: 0, y: 1, w: 6, h: 4, tabs: ['workload', 'due-forecast'] },
    ];
    await ws.owner.data(SAVE, { w, input: { pageKey: 'home', baseVersion: null, items: layout } });
    const stored = (await ws.owner.data<{ myLayout: { items: { id: string; type: string; h: number; tabs: string[] | null; config: { title: string } | null }[] } }>(READ, { w, p: 'home' })).myLayout.items;
    expect(stored).toEqual([
      { id: 'section-1', type: 'section', h: 1, tabs: null, config: { title: 'This week' } },
      { id: 'priority', type: 'priority', h: 4, tabs: ['workload', 'due-forecast'], config: null },
    ]);
    const bad = (items: unknown[]) => ws.owner.error(SAVE, { w, input: { pageKey: 'home', baseVersion: 1, items } });
    expect((await bad([{ ...layout[1], tabs: ['phases'] }])).message).toMatch(/stacked tabs must be other blocks of this page/);
    expect((await bad([{ id: 'status', type: 'status', x: 0, y: 0, w: 6, h: 1 }])).message).toMatch(/size out of range/);
  });

  it('gives a team its own starting layout, set by layout managers or the team head, audited', async () => {
    const ws = await createWorkspace('Team layouts');
    const w = ws.workspaceId;
    const [designer, seller, lead, admin] = await Promise.all([TestUser.signUp('Team designer'), TestUser.signUp('Team seller'), TestUser.signUp('Design lead'), TestUser.signUp('Team layouts admin')]);
    for (const user of [designer, seller, lead]) await addMember(ws, user, 'Member');
    await addMember(ws, admin, 'Admin');
    const DEPARTMENT = 'mutation($w: ID!, $input: CreateDepartmentInput!) { createDepartment(workspaceId: $w, input: $input) { id } }';
    const PROFILE = 'mutation($w: ID!, $u: ID!, $input: EmployeeProfileInput!) { upsertEmployeeProfile(workspaceId: $w, userId: $u, input: $input) { userId } }';
    const MINE = 'query($w: ID!, $p: String!) { myTeamLayout(workspaceId: $w, pageKey: $p) { departmentName items { id } updatedByName } }';
    const TARGETS = 'query($w: ID!, $p: String!) { teamLayoutTargets(workspaceId: $w, pageKey: $p) { departmentId name hasDefault } }';
    const SET = 'mutation($w: ID!, $input: SetTeamLayoutInput!) { setTeamLayout(workspaceId: $w, input: $input) { name hasDefault } }';
    const CLEAR = 'mutation($w: ID!, $d: ID!, $p: String!) { clearTeamLayout(workspaceId: $w, departmentId: $d, pageKey: $p) }';
    const design = (await ws.owner.data<{ createDepartment: { id: string } }>(DEPARTMENT, { w, input: { name: 'Design', headUserId: lead.id } })).createDepartment.id;
    const sales = (await ws.owner.data<{ createDepartment: { id: string } }>(DEPARTMENT, { w, input: { name: 'Sales' } })).createDepartment.id;
    await ws.owner.data(PROFILE, { w, u: designer.id, input: { departmentId: design } });
    await ws.owner.data(PROFILE, { w, u: seller.id, input: { departmentId: sales } });
    const layout = [{ id: 'workload', type: 'workload', x: 0, y: 0, w: 6, h: 7 }];
    const targets = async (user: TestUser) => (await user.data<{ teamLayoutTargets: { name: string; hasDefault: boolean }[] }>(TARGETS, { w, p: 'home' })).teamLayoutTargets;

    // Who may set which team's default.
    expect(await targets(designer)).toEqual([]);
    expect((await targets(lead)).map((team) => team.name)).toEqual(['Design']);
    expect((await targets(admin)).map((team) => team.name)).toEqual(['Design', 'Sales']);
    expect((await designer.error(SET, { w, input: { departmentId: design, pageKey: 'home', items: layout } })).code).toBe('FORBIDDEN');
    expect((await lead.error(SET, { w, input: { departmentId: sales, pageKey: 'home', items: layout } })).code).toBe('FORBIDDEN');
    expect((await lead.error(SET, { w, input: { departmentId: design, pageKey: 'home', items: [{ ...layout[0]!, type: 'phases' }] } })).message).toMatch(/unknown block type/);

    // The head sets Design's: Design's people start from it; Sales's don't.
    expect((await lead.data<{ setTeamLayout: unknown }>(SET, { w, input: { departmentId: design, pageKey: 'home', items: layout } })).setTeamLayout).toEqual({ name: 'Design', hasDefault: true });
    expect((await designer.data<{ myTeamLayout: unknown }>(MINE, { w, p: 'home' })).myTeamLayout).toEqual({ departmentName: 'Design', items: [{ id: 'workload' }], updatedByName: 'Design lead' });
    expect((await seller.data<{ myTeamLayout: unknown }>(MINE, { w, p: 'home' })).myTeamLayout).toBeNull();
    expect((await targets(admin)).find((team) => team.name === 'Design')?.hasDefault).toBe(true);
    // Another workspace can't touch it.
    const other = await createWorkspace('Team layouts other');
    expect((await other.owner.error(CLEAR, { w: other.workspaceId, d: design, p: 'home' })).code).toBe('NOT_FOUND');

    expect((await admin.data<{ clearTeamLayout: boolean }>(CLEAR, { w, d: design, p: 'home' })).clearTeamLayout).toBe(true);
    expect((await designer.data<{ myTeamLayout: unknown }>(MINE, { w, p: 'home' })).myTeamLayout).toBeNull();
    const audit = (await ws.owner.data<{ workspaceAuditLog: { items: { action: string }[] } }>('query($w: ID!) { workspaceAuditLog(workspaceId: $w) { items { action } } }', { w })).workspaceAuditLog.items.map((entry) => entry.action);
    expect(audit).toEqual(expect.arrayContaining(['layout.team_default.set', 'layout.team_default.clear']));
  });
});
