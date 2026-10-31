import { PREFERENCE_LIMITS, type WorkspaceTab } from '@taskflow/shared-types';
import { describe, expect, it } from 'vitest';
import { closeOthers, closeTab, cycleTarget, followNavigation, fromStored, moveTab, nthTab, togglePin, workspaceOfPath, type TabsState } from './tabs';

const WS = '11111111-1111-4111-8111-111111111111';
const OTHER = '22222222-2222-4222-8222-222222222222';
const p = (rest = '', ws = WS) => `/w/${ws}${rest}`;
const tab = (id: string, path: string, pinned = false): WorkspaceTab => ({ id, path, title: id, pinned });
let counter = 0;
const nextId = () => `n${++counter}`;
const state = (tabs: WorkspaceTab[], active?: string): TabsState => ({ tabs, active: active ? { [WS]: active } : {} });

describe('workbench tabs', () => {
  it('reads the workspace from a path', () => {
    expect(workspaceOfPath(p('/inbox'))).toBe(WS);
    expect(workspaceOfPath(p('?task=x'))).toBe(WS);
    expect(workspaceOfPath('/admin/users')).toBeNull();
  });

  it('opens a first tab, then lets the active tab follow navigation', () => {
    let s = followNavigation(state([]), WS, p(), 'Home', nextId);
    expect(s.tabs).toHaveLength(1);
    const id = s.tabs[0]!.id;
    s = followNavigation(s, WS, p('/inbox'), 'Inbox', nextId);
    expect(s.tabs).toEqual([{ id, path: p('/inbox'), title: 'Inbox', pinned: false }]);
    expect(s.active[WS]).toBe(id);
  });

  it('switches to a tab that already shows the page instead of duplicating it', () => {
    const s = followNavigation(state([tab('a', p()), tab('b', p('/inbox'))], 'a'), WS, p('/inbox'), 'Inbox', nextId);
    expect(s.tabs.map((t) => t.path)).toEqual([p(), p('/inbox')]);
    expect(s.active[WS]).toBe('b');
  });

  it('keeps a pinned tab on its page and opens a new tab instead', () => {
    const s = followNavigation(state([tab('a', p('/inbox'), true)], 'a'), WS, p('/docs'), 'Docs', nextId);
    expect(s.tabs.map((t) => [t.path, t.pinned])).toEqual([
      [p('/inbox'), true],
      [p('/docs'), false],
    ]);
    expect(s.active[WS]).toBe(s.tabs[1]!.id);
  });

  it('never goes over the server limit, dropping an inactive unpinned tab', () => {
    const many = Array.from({ length: PREFERENCE_LIMITS.tabs }, (_, i) => tab(`t${i}`, p(`/l/${i}`), i === 0));
    const s = followNavigation(state(many, 't0'), WS, p('/docs'), 'Docs', nextId);
    expect(s.tabs).toHaveLength(PREFERENCE_LIMITS.tabs);
    expect(s.tabs.some((t) => t.id === 't0')).toBe(true);
    expect(s.tabs.some((t) => t.id === 't1')).toBe(false);
  });

  it('activates the right neighbour on close, and replaces the last tab with home', () => {
    const s = state([tab('a', p()), tab('b', p('/inbox')), tab('c', p('/docs'))], 'b');
    expect(closeTab(s, WS, 'b', nextId)).toMatchObject({ navigateTo: p('/docs'), state: { active: { [WS]: 'c' } } });
    expect(closeTab(state([tab('a', p()), tab('b', p('/x'))], 'b'), WS, 'b', nextId).navigateTo).toBe(p());
    expect(closeTab(s, WS, 'a', nextId).navigateTo).toBeNull();
    const last = closeTab(state([tab('a', p('/inbox'))], 'a'), WS, 'a', nextId);
    expect(last.state.tabs).toEqual([expect.objectContaining({ path: p(), title: 'Home' })]);
    expect(last.navigateTo).toBe(p());
  });

  it('leaves other workspaces alone', () => {
    const s = state([tab('a', p()), tab('x', p('', OTHER)), tab('b', p('/inbox'))], 'a');
    expect(closeOthers(s, WS, 'a').tabs.map((t) => t.id)).toEqual(['a', 'x']);
    expect(cycleTarget(s, WS, 1)?.id).toBe('b');
    expect(cycleTarget(s, WS, -1)?.id).toBe('b');
    expect(nthTab(s, WS, 9)?.id).toBe('b');
  });

  it('keeps pinned tabs first and reorders within a group only', () => {
    let s = togglePin(state([tab('a', p()), tab('b', p('/inbox'))]), 'b');
    expect(s.tabs.map((t) => t.id)).toEqual(['b', 'a']);
    expect(moveTab(s, 'a', 'b')).toBe(s);
    s = moveTab(state([tab('a', p()), tab('b', p('/1')), tab('c', p('/2'))]), 'c', 'a');
    expect(s.tabs.map((t) => t.id)).toEqual(['c', 'a', 'b']);
  });

  it('cleans up stored tabs', () => {
    expect(fromStored([tab('a', '/admin'), tab('b', p()), tab('b', p('/x')), tab('c', p('/y'), true)]).map((t) => t.id)).toEqual(['c', 'b']);
  });
});
