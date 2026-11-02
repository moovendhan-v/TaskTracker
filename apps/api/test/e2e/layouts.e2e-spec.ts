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
});
