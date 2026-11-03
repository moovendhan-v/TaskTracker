import { describe, expect, it } from 'vitest';
import { TestUser } from './support/api-client.js';
import { addMember, createWorkspace } from './support/fixtures.js';

const LIST = 'query($w: ID!) { dashboards(workspaceId: $w) { id name visibility mine version items { id } } }';
const CREATE = 'mutation($w: ID!, $input: CreateDashboardInput!) { createDashboard(workspaceId: $w, input: $input) { id version visibility mine items { id } } }';
const UPDATE = 'mutation($w: ID!, $d: ID!, $input: UpdateDashboardInput!) { updateDashboard(workspaceId: $w, dashboardId: $d, input: $input) { name visibility } }';
const SAVE = 'mutation($w: ID!, $d: ID!, $input: SaveDashboardLayoutInput!) { saveDashboardLayout(workspaceId: $w, dashboardId: $d, input: $input) { version items { id } } }';
const DELETE = 'mutation($w: ID!, $d: ID!) { deleteDashboard(workspaceId: $w, dashboardId: $d) }';
const one = [{ id: 'status', type: 'status', x: 0, y: 0, w: 6, h: 4 }];

type Listed = { id: string; name: string; visibility: string; mine: boolean };

describe('named dashboards', () => {
  it('keeps private dashboards to the owner and lets only the owner change shared ones', async () => {
    const ws = await createWorkspace('Dashboards owner');
    const w = ws.workspaceId;
    const member = await TestUser.signUp('Dashboards member');
    await addMember(ws, member, 'Member');

    const mine = (await ws.owner.data<{ createDashboard: { id: string; items: unknown[]; mine: boolean } }>(CREATE, { w, input: { name: 'My stats' } })).createDashboard;
    expect(mine.mine).toBe(true);
    expect(mine.items.length).toBeGreaterThan(5); // starts from the default Home layout
    const shared = (await ws.owner.data<{ createDashboard: { id: string } }>(CREATE, { w, input: { name: 'Sprint health', visibility: 'workspace', items: one } })).createDashboard;

    // The member sees only the shared one, marked as not theirs.
    const seen = (await member.data<{ dashboards: Listed[] }>(LIST, { w })).dashboards;
    expect(seen.map((d) => [d.name, d.mine])).toEqual([['Sprint health', false]]);

    // …and can't change it, or even find the private one.
    expect((await member.error(UPDATE, { w, d: shared.id, input: { name: 'Mine now' } })).code).toBe('FORBIDDEN');
    expect((await member.error(SAVE, { w, d: shared.id, input: { baseVersion: 1, items: [] } })).code).toBe('FORBIDDEN');
    expect((await member.error(DELETE, { w, d: shared.id })).code).toBe('FORBIDDEN');
    expect((await member.error(UPDATE, { w, d: mine.id, input: { visibility: 'workspace' } })).code).toBe('NOT_FOUND');
    expect((await member.error(DELETE, { w, d: mine.id })).code).toBe('NOT_FOUND');

    // The owner unshares: it disappears for the member.
    expect((await ws.owner.data<{ updateDashboard: { visibility: string } }>(UPDATE, { w, d: shared.id, input: { visibility: 'private' } })).updateDashboard.visibility).toBe('private');
    expect((await member.data<{ dashboards: Listed[] }>(LIST, { w })).dashboards).toEqual([]);

    // The member's own dashboards are theirs alone.
    await member.data(CREATE, { w, input: { name: 'Member board', items: one } });
    expect((await ws.owner.data<{ dashboards: Listed[] }>(LIST, { w })).dashboards.map((d) => d.name).sort()).toEqual(['My stats', 'Sprint health']);

    // Outsiders get nothing.
    const outsider = await TestUser.signUp('Dashboards outsider');
    expect((await outsider.error(LIST, { w })).code).toMatch(/FORBIDDEN|NOT_FOUND/);
  });

  it('saves layouts with versions, validates them, and caps the count', async () => {
    const ws = await createWorkspace('Dashboards rules');
    const w = ws.workspaceId;
    const { createDashboard } = await ws.owner.data<{ createDashboard: { id: string; version: number } }>(CREATE, { w, input: { name: 'Ops', items: one } });
    const d = createDashboard.id;
    expect((await ws.owner.data<{ saveDashboardLayout: { version: number } }>(SAVE, { w, d, input: { baseVersion: 1, items: [] } })).saveDashboardLayout.version).toBe(2);
    expect((await ws.owner.error(SAVE, { w, d, input: { baseVersion: 1, items: one } })).code).toBe('CONFLICT');
    expect((await ws.owner.error(SAVE, { w, d, input: { baseVersion: 2, items: [{ ...one[0], type: 'nope' }] } })).message).toMatch(/unknown block type/);
    expect((await ws.owner.error(CREATE, { w, input: { name: '   ' } })).code).toBe('BAD_USER_INPUT');
    expect((await ws.owner.error(UPDATE, { w, d, input: { visibility: 'team' } })).code).toBe('BAD_USER_INPUT');

    for (let i = 1; i < 20; i++) await ws.owner.data(CREATE, { w, input: { name: `D${i}`, items: [] } });
    expect((await ws.owner.error(CREATE, { w, input: { name: 'One too many', items: [] } })).message).toMatch(/at most 20/);
    expect((await ws.owner.data<{ deleteDashboard: boolean }>(DELETE, { w, d })).deleteDashboard).toBe(true);
  });

  it('remembers the date range the owner picks, for everyone who opens it', async () => {
    const ws = await createWorkspace('Period owner');
    const w = ws.workspaceId;
    const member = await TestUser.signUp('Period member');
    await addMember(ws, member, 'Member');
    const PERIOD = 'mutation($w: ID!, $d: ID!, $input: UpdateDashboardInput!) { updateDashboard(workspaceId: $w, dashboardId: $d, input: $input) { period name } }';
    const LISTED = 'query($w: ID!) { dashboards(workspaceId: $w) { id period } }';
    const d = (await ws.owner.data<{ createDashboard: { id: string } }>(CREATE, { w, input: { name: 'Monthly', visibility: 'workspace', items: one } })).createDashboard.id;
    const periodSeenBy = async (user: TestUser) => (await user.data<{ dashboards: { id: string; period: string | null }[] }>(LISTED, { w })).dashboards.find((item) => item.id === d)?.period;

    expect(await periodSeenBy(member)).toBeNull();
    expect((await ws.owner.data<{ updateDashboard: { period: string; name: string } }>(PERIOD, { w, d, input: { period: 'last_month' } })).updateDashboard).toEqual({ period: 'last_month', name: 'Monthly' });
    expect(await periodSeenBy(member)).toBe('last_month');
    // Renaming keeps it; only the owner can change it; only known ranges are accepted.
    await ws.owner.data(PERIOD, { w, d, input: { name: 'Last month' } });
    expect(await periodSeenBy(ws.owner)).toBe('last_month');
    expect((await member.error(PERIOD, { w, d, input: { period: 'this_week' } })).code).toBe('FORBIDDEN');
    expect((await ws.owner.error(PERIOD, { w, d, input: { period: 'forever' } })).code).toBe('BAD_USER_INPUT');
  });
});
