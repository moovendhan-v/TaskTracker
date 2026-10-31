import { PREFERENCE_LIMITS, type WorkspaceTab } from '@taskflow/shared-types';

/**
 * Workbench tabs: every page opens in a tab, like a browser inside the app.
 * Pure functions only, so the rules are easy to test; the store and the strip
 * call them. Tabs for all workspaces live in one list (the server keeps up to
 * PREFERENCE_LIMITS.tabs); each tab's path says which workspace it belongs to.
 */

export interface TabsState {
  tabs: WorkspaceTab[];
  /** The active tab of each workspace. */
  active: Record<string, string>;
}

const MAX_PATH = 500;
const WORKSPACE_PATH = /^\/w\/([0-9a-f-]{36})(?=\/|\?|$)/i;

export function workspaceOfPath(path: string): string | null {
  return WORKSPACE_PATH.exec(path)?.[1]?.toLowerCase() ?? null;
}

export function homePath(workspaceId: string): string {
  return `/w/${workspaceId}`;
}

/** Paths are stored as typed; very long ones keep only the page, not its query. */
export function normalizePath(path: string): string {
  return path.length <= MAX_PATH ? path : path.split('?')[0]!.slice(0, MAX_PATH);
}

export function tabsOf(state: TabsState, workspaceId: string): WorkspaceTab[] {
  return state.tabs.filter((tab) => workspaceOfPath(tab.path) === workspaceId);
}

export function activeTab(state: TabsState, workspaceId: string): WorkspaceTab | undefined {
  const tabs = tabsOf(state, workspaceId);
  return tabs.find((tab) => tab.id === state.active[workspaceId]) ?? tabs[0];
}

/** Pinned tabs sit first, in their own order; the rest keep theirs. */
function ordered(tabs: WorkspaceTab[]): WorkspaceTab[] {
  return [...tabs.filter((tab) => tab.pinned), ...tabs.filter((tab) => !tab.pinned)];
}

/** Makes room for one more tab by dropping the first unpinned, inactive tab (this workspace's last). */
function withRoom(state: TabsState, workspaceId: string): WorkspaceTab[] {
  if (state.tabs.length < PREFERENCE_LIMITS.tabs) return state.tabs;
  const activeIds = new Set(Object.values(state.active));
  const removable = (tab: WorkspaceTab) => !tab.pinned && !activeIds.has(tab.id);
  const victim = state.tabs.find((tab) => removable(tab) && workspaceOfPath(tab.path) !== workspaceId) ?? state.tabs.find(removable);
  return victim ? state.tabs.filter((tab) => tab !== victim) : state.tabs;
}

export function openTab(state: TabsState, workspaceId: string, tab: WorkspaceTab): TabsState {
  return { tabs: ordered([...withRoom(state, workspaceId), tab]), active: { ...state.active, [workspaceId]: tab.id } };
}

/**
 * The app navigated to `path`. If a tab already shows it, that tab becomes active.
 * Otherwise the active tab follows the navigation, unless it is pinned: pinned tabs
 * keep their page and the navigation opens a new tab instead.
 */
export function followNavigation(state: TabsState, workspaceId: string, rawPath: string, title: string, newId: () => string): TabsState {
  const path = normalizePath(rawPath);
  const current = activeTab(state, workspaceId);
  if (current?.path === path) {
    return state.active[workspaceId] === current.id && current.title === title ? state : withTitle(activate(state, workspaceId, current.id), current.id, title);
  }
  const existing = tabsOf(state, workspaceId).find((tab) => tab.path === path);
  if (existing) return activate(state, workspaceId, existing.id);
  if (current && !current.pinned) {
    return { tabs: state.tabs.map((tab) => (tab.id === current.id ? { ...tab, path, title } : tab)), active: { ...state.active, [workspaceId]: current.id } };
  }
  return openTab(state, workspaceId, { id: newId(), path, title, pinned: false });
}

export function activate(state: TabsState, workspaceId: string, tabId: string): TabsState {
  return state.active[workspaceId] === tabId ? state : { ...state, active: { ...state.active, [workspaceId]: tabId } };
}

function withTitle(state: TabsState, tabId: string, title: string): TabsState {
  return { ...state, tabs: state.tabs.map((tab) => (tab.id === tabId && tab.title !== title ? { ...tab, title } : tab)) };
}

/**
 * Closes a tab. If it was active, its right-hand neighbour (else the left) takes over.
 * The last tab of a workspace is replaced by a home tab, so there's always one.
 * Returns the path to show when the active tab changed.
 */
export function closeTab(state: TabsState, workspaceId: string, tabId: string, newId: () => string): { state: TabsState; navigateTo: string | null } {
  const tabs = tabsOf(state, workspaceId);
  const index = tabs.findIndex((tab) => tab.id === tabId);
  if (index === -1) return { state, navigateTo: null };
  const remaining = state.tabs.filter((tab) => tab.id !== tabId);
  const wasActive = activeTab(state, workspaceId)?.id === tabId;
  if (!wasActive) return { state: { ...state, tabs: remaining }, navigateTo: null };
  const next = tabs[index + 1] ?? tabs[index - 1];
  if (next) return { state: { tabs: remaining, active: { ...state.active, [workspaceId]: next.id } }, navigateTo: next.path };
  const home: WorkspaceTab = { id: newId(), path: homePath(workspaceId), title: 'Home', pinned: false };
  return { state: { tabs: [...remaining, home], active: { ...state.active, [workspaceId]: home.id } }, navigateTo: home.path };
}

/** Closes every unpinned tab of the workspace except `keepId`, which becomes active. */
export function closeOthers(state: TabsState, workspaceId: string, keepId: string): TabsState {
  const tabs = state.tabs.filter((tab) => tab.id === keepId || tab.pinned || workspaceOfPath(tab.path) !== workspaceId);
  return { tabs, active: { ...state.active, [workspaceId]: keepId } };
}

export function togglePin(state: TabsState, tabId: string): TabsState {
  return { ...state, tabs: ordered(state.tabs.map((tab) => (tab.id === tabId ? { ...tab, pinned: !tab.pinned } : tab))) };
}

/** Moves a tab to where `targetId` is, within the same pinned / unpinned group. */
export function moveTab(state: TabsState, tabId: string, targetId: string): TabsState {
  const from = state.tabs.findIndex((tab) => tab.id === tabId);
  const to = state.tabs.findIndex((tab) => tab.id === targetId);
  if (from === -1 || to === -1 || from === to || state.tabs[from]!.pinned !== state.tabs[to]!.pinned) return state;
  const tabs = [...state.tabs];
  const [moved] = tabs.splice(from, 1);
  tabs.splice(to, 0, moved!);
  return { ...state, tabs };
}

/** Moves a tab one step left (-1) or right (+1) among the workspace's tabs, for keyboard users. */
export function nudgeTab(state: TabsState, workspaceId: string, tabId: string, step: -1 | 1): TabsState {
  const tabs = tabsOf(state, workspaceId);
  const index = tabs.findIndex((tab) => tab.id === tabId);
  const target = tabs[index + step];
  return index === -1 || !target ? state : moveTab(state, tabId, target.id);
}

/** The tab `step` places from the active one, wrapping round; or the n-th (1-based, 9 = last). */
export function cycleTarget(state: TabsState, workspaceId: string, step: -1 | 1): WorkspaceTab | undefined {
  const tabs = tabsOf(state, workspaceId);
  const index = tabs.findIndex((tab) => tab.id === activeTab(state, workspaceId)?.id);
  return tabs.length ? tabs[(index + step + tabs.length) % tabs.length] : undefined;
}

export function nthTab(state: TabsState, workspaceId: string, n: number): WorkspaceTab | undefined {
  const tabs = tabsOf(state, workspaceId);
  return n >= 9 ? tabs.at(-1) : tabs[n - 1];
}

/** Server copy → local state: keeps only well-formed tabs, pinned first, within the limit. */
export function fromStored(tabs: readonly WorkspaceTab[]): WorkspaceTab[] {
  const seen = new Set<string>();
  const valid = tabs.filter((tab) => workspaceOfPath(tab.path) && !seen.has(tab.id) && seen.add(tab.id));
  return ordered(valid).slice(0, PREFERENCE_LIMITS.tabs);
}

/** A short random id that fits the API's tab id rule. */
export function newTabId(): string {
  return `t${crypto.randomUUID().replaceAll('-', '').slice(0, 16)}`;
}
