import { TASK_PRIORITIES, type StatusCategory, type TaskPriority } from './task.js';

/**
 * Arrangeable dashboard layouts (v2 "lego" grid). Shared so the server
 * validates exactly what the client produces.
 */

export const GRID_COLUMNS = 12;

export const LAYOUT_LIMITS = {
  items: 40,
  maxRow: 400,
  minW: 2,
  maxH: 16,
  minH: 2,
  idMax: 40,
  /** Other blocks stacked in one slot as tabs. */
  tabsMax: 4,
} as const;

/**
 * A full-width heading that splits a page into regions. It has no data, only a
 * title (and colour), and is the one block that may be a single row high.
 */
export const SECTION_BLOCK = 'section';

/** The shortest a block of this type may be. */
export function minHeightOf(type: string): number {
  return type === SECTION_BLOCK ? 1 : LAYOUT_LIMITS.minH;
}

/** Block types that can sit in a stack of tabs (anything with data; not sections). */
export function canStack(type: string): boolean {
  return type !== SECTION_BLOCK;
}

/** Pages that can be arranged, and the blocks each one can hold. */
export const LAYOUT_PAGES = ['home', 'project'] as const;
export type LayoutPage = (typeof LAYOUT_PAGES)[number];

export const HOME_BLOCK_TYPES = [
  'status',
  'priority',
  'overdue-aging',
  'due-forecast',
  'created-closed',
  'hours-per-day',
  'hours-by-person',
  'hours-by-project',
  'overdue-tasks',
  'due-soon-tasks',
  'workload',
  'recent-tasks',
  'section',
] as const;
export type HomeBlockType = (typeof HOME_BLOCK_TYPES)[number];

/** A project's dashboard tab. One arrangement per person, used for every project. */
export const PROJECT_BLOCK_TYPES = [
  'project-status',
  'kpis',
  'status-breakdown',
  'hours-per-day',
  'hours-by-task',
  'phases',
  'people',
  'overdue-tasks',
  'due-soon-tasks',
  'recent-tasks',
  'section',
] as const;
export type ProjectBlockType = (typeof PROJECT_BLOCK_TYPES)[number];

export const BLOCK_TYPES_BY_PAGE: Record<LayoutPage, readonly string[]> = { home: HOME_BLOCK_TYPES, project: PROJECT_BLOCK_TYPES };

export interface LayoutItem {
  /** Stable id of this placed block, unique within the layout. */
  id: string;
  type: string;
  x: number;
  y: number;
  w: number;
  h: number;
  /** How this block is set up (B3); absent means the block's defaults. */
  config?: BlockConfig | null;
  /** Other block types stacked in this slot, shown as tabs after this one (B2). */
  tabs?: string[] | null;
}

/** Accent colours a block can wear, from the theme's palette. */
export const BLOCK_ACCENTS = ['orange', 'blue', 'green', 'violet', 'pink', 'amber'] as const;
export type BlockAccent = (typeof BLOCK_ACCENTS)[number];
export const BLOCK_LIMITS = [5, 10, 20] as const;
export const BLOCK_TITLE_MAX = 60;

/** Columns a task-list block can show, in the order picked. The title always shows. */
export const TASK_LIST_FIELDS = ['number', 'status', 'priority', 'date', 'assignee', 'project'] as const;
export type TaskListField = (typeof TASK_LIST_FIELDS)[number];

/**
 * One block's settings. Data (where its numbers come from) is kept apart from
 * view (how it looks): changing the view never changes what the block may read.
 */
export interface BlockConfig {
  /** View: a title of your own. */
  title?: string;
  /** View: an accent colour. */
  accent?: BlockAccent;
  /** Data: one project instead of all of them (Home blocks). Read with the viewer's own access. */
  spaceId?: string;
  /** View: how many tasks a list shows. */
  limit?: (typeof BLOCK_LIMITS)[number];
  /** View: count closed work too (status breakdowns). */
  includeClosed?: boolean;
  /** Data: only tasks assigned to the viewer (resolved from their session on the server). */
  mine?: boolean;
  /** Data: only tasks with these priorities. */
  priorities?: TaskPriority[];
  /** View: which columns a task list shows, in order. */
  fields?: TaskListField[];
  /** Data: only open tasks whose status means one of these (task lists). */
  categories?: StatusCategory[];
  /** View: bars or a line, for blocks that chart over time. */
  chart?: BlockChart;
  /** Data: only tasks assigned to these people (task lists). Can't be combined with `mine`. */
  assigneeIds?: string[];
  /** Data: narrow to the person or project picked elsewhere on the page (the page's selection). */
  followContext?: boolean;
}

/** At most this many people in a block's assignee filter. */
export const BLOCK_ASSIGNEES_MAX = 20;
/** Blocks that don't read data, so there's nothing for a page selection to narrow. */
const NO_CONTEXT_BLOCKS = ['project-status'];

/** How a time-series block draws. */
export const BLOCK_CHARTS = ['bar', 'line'] as const;
export type BlockChart = (typeof BLOCK_CHARTS)[number];
/** Blocks that chart something over time, and so offer bars or a line. */
const CHART_BLOCKS = ['hours-per-day', 'created-closed'];
/** Status meanings a task list can narrow to (closed ones aren't in these lists). */
export const OPEN_STATUS_CATEGORIES = ['unstarted', 'started', 'review', 'blocked'] as const satisfies readonly StatusCategory[];

export type BlockConfigKey = keyof BlockConfig;

const VIEW_KEYS: readonly BlockConfigKey[] = ['title', 'accent'];
/** Task-list blocks (the same types on Home and project dashboards). */
const TASK_LISTS = ['overdue-tasks', 'due-soon-tasks', 'recent-tasks'];

/** Which settings a block offers. Home blocks can also pick their data source. */
export function blockConfigKeys(pageKey: LayoutPage, type: string): BlockConfigKey[] {
  const keys: BlockConfigKey[] = [...VIEW_KEYS];
  if (type === SECTION_BLOCK) return keys;
  if (!NO_CONTEXT_BLOCKS.includes(type)) keys.push('followContext');
  if (pageKey === 'home' && !['hours-by-project'].includes(type)) keys.push('spaceId');
  if (TASK_LISTS.includes(type)) keys.push('limit', 'mine', 'assigneeIds', 'priorities', 'categories', 'fields');
  if (CHART_BLOCKS.includes(type)) keys.push('chart');
  if (type === 'status' || type === 'status-breakdown') keys.push('includeClosed');
  return keys;
}

/** A user id: letters, digits, dashes and underscores (auth ids aren't always UUIDs). */
const USER_ID = /^[A-Za-z0-9_-]{1,64}$/;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function isSubsetOf(values: unknown, allowed: readonly string[]): boolean {
  return Array.isArray(values) && values.length <= allowed.length && new Set(values).size === values.length && values.every((value) => allowed.includes(value as string));
}

/** Problems with one block's settings; empty when they are fine. */
export function validateBlockConfig(pageKey: LayoutPage, type: string, config: BlockConfig): string[] {
  const problems: string[] = [];
  const allowed = blockConfigKeys(pageKey, type);
  for (const key of Object.keys(config) as BlockConfigKey[]) {
    if (!allowed.includes(key)) problems.push(`${key} isn't a setting of this block`);
  }
  if (config.title !== undefined && (typeof config.title !== 'string' || config.title.trim().length === 0 || config.title.length > BLOCK_TITLE_MAX)) {
    problems.push(`title must be 1 to ${BLOCK_TITLE_MAX} characters`);
  }
  if (config.accent !== undefined && !(BLOCK_ACCENTS as readonly string[]).includes(config.accent)) problems.push('unknown accent');
  if (config.spaceId !== undefined && (typeof config.spaceId !== 'string' || !UUID.test(config.spaceId))) problems.push('spaceId must be a project id');
  if (config.limit !== undefined && !(BLOCK_LIMITS as readonly number[]).includes(config.limit)) problems.push('limit must be 5, 10 or 20');
  if (config.includeClosed !== undefined && typeof config.includeClosed !== 'boolean') problems.push('includeClosed must be true or false');
  if (config.mine !== undefined && typeof config.mine !== 'boolean') problems.push('mine must be true or false');
  if (config.priorities !== undefined && !isSubsetOf(config.priorities, TASK_PRIORITIES)) problems.push('priorities: pick from the list, each once');
  if (config.fields !== undefined && !isSubsetOf(config.fields, TASK_LIST_FIELDS)) problems.push('fields: pick from the list, each once');
  if (config.categories !== undefined && !isSubsetOf(config.categories, OPEN_STATUS_CATEGORIES)) problems.push('categories: pick from the list, each once');
  if (config.chart !== undefined && !(BLOCK_CHARTS as readonly string[]).includes(config.chart)) problems.push('chart must be bar or line');
  if (config.followContext !== undefined && typeof config.followContext !== 'boolean') problems.push('followContext must be true or false');
  if (config.assigneeIds !== undefined) {
    const ids = config.assigneeIds as unknown;
    if (!Array.isArray(ids) || ids.length > BLOCK_ASSIGNEES_MAX || new Set(ids).size !== ids.length || !ids.every((id) => typeof id === 'string' && USER_ID.test(id))) {
      problems.push(`assigneeIds: up to ${BLOCK_ASSIGNEES_MAX} people, each once`);
    } else if (config.mine && ids.length) problems.push('pick "mine" or people, not both');
  }
  return problems;
}

/** Drops empty values, so "no setting" is stored as nothing. */
export function cleanBlockConfig(config: BlockConfig | null | undefined): BlockConfig | undefined {
  if (!config) return undefined;
  const entries = Object.entries(config).filter(([key, value]) => value !== undefined && value !== null && value !== '' && !((key === 'priorities' || key === 'categories' || key === 'assigneeIds') && Array.isArray(value) && value.length === 0) && !((key === 'mine' || key === 'followContext') && value === false));
  return entries.length ? (Object.fromEntries(entries) as BlockConfig) : undefined;
}

export interface DashboardLayout {
  pageKey: LayoutPage;
  version: number;
  items: LayoutItem[];
  updatedAt: string;
}

/** What a page shows before the user arranges anything. */
export const DEFAULT_LAYOUTS: Record<LayoutPage, LayoutItem[]> = {
  home: [
    { id: 'status', type: 'status', x: 0, y: 0, w: 4, h: 5 },
    { id: 'priority', type: 'priority', x: 4, y: 0, w: 4, h: 5 },
    { id: 'overdue-aging', type: 'overdue-aging', x: 8, y: 0, w: 4, h: 5 },
    { id: 'due-forecast', type: 'due-forecast', x: 0, y: 5, w: 6, h: 6 },
    { id: 'created-closed', type: 'created-closed', x: 6, y: 5, w: 6, h: 6 },
    { id: 'hours-per-day', type: 'hours-per-day', x: 0, y: 11, w: 4, h: 5 },
    { id: 'hours-by-person', type: 'hours-by-person', x: 4, y: 11, w: 4, h: 5 },
    { id: 'hours-by-project', type: 'hours-by-project', x: 8, y: 11, w: 4, h: 5 },
    { id: 'overdue-tasks', type: 'overdue-tasks', x: 0, y: 16, w: 4, h: 7 },
    { id: 'due-soon-tasks', type: 'due-soon-tasks', x: 4, y: 16, w: 4, h: 7 },
    { id: 'workload', type: 'workload', x: 8, y: 16, w: 4, h: 7 },
    { id: 'recent-tasks', type: 'recent-tasks', x: 0, y: 23, w: 12, h: 6 },
  ],
  project: [
    { id: 'project-status', type: 'project-status', x: 0, y: 0, w: 12, h: 4 },
    { id: 'kpis', type: 'kpis', x: 0, y: 4, w: 12, h: 4 },
    { id: 'status-breakdown', type: 'status-breakdown', x: 0, y: 8, w: 12, h: 3 },
    { id: 'hours-per-day', type: 'hours-per-day', x: 0, y: 11, w: 6, h: 6 },
    { id: 'hours-by-task', type: 'hours-by-task', x: 6, y: 11, w: 6, h: 6 },
    { id: 'phases', type: 'phases', x: 0, y: 17, w: 12, h: 7 },
    { id: 'people', type: 'people', x: 0, y: 24, w: 4, h: 7 },
    { id: 'overdue-tasks', type: 'overdue-tasks', x: 4, y: 24, w: 4, h: 7 },
    { id: 'due-soon-tasks', type: 'due-soon-tasks', x: 8, y: 24, w: 4, h: 7 },
    { id: 'recent-tasks', type: 'recent-tasks', x: 0, y: 31, w: 12, h: 6 },
  ],
};

export function isLayoutPage(value: string): value is LayoutPage {
  return (LAYOUT_PAGES as readonly string[]).includes(value);
}

const ID_PATTERN = /^[a-z0-9][a-z0-9-]*$/;
const isInt = (value: unknown): value is number => typeof value === 'number' && Number.isInteger(value);

export function overlaps(a: LayoutItem, b: LayoutItem): boolean {
  return a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
}

/** Every problem with a layout for a page; empty when it is valid. */
export function validateLayoutItems(pageKey: LayoutPage, items: readonly LayoutItem[]): string[] {
  const problems: string[] = [];
  const types = BLOCK_TYPES_BY_PAGE[pageKey];
  if (items.length > LAYOUT_LIMITS.items) problems.push(`At most ${LAYOUT_LIMITS.items} blocks`);
  const ids = new Set<string>();
  items.forEach((item, index) => {
    const at = `Block ${index + 1}`;
    if (typeof item.id !== 'string' || item.id.length > LAYOUT_LIMITS.idMax || !ID_PATTERN.test(item.id)) problems.push(`${at}: invalid id`);
    else if (ids.has(item.id)) problems.push(`${at}: duplicate id`);
    else ids.add(item.id);
    if (!types.includes(item.type)) problems.push(`${at}: unknown block type`);
    if (![item.x, item.y, item.w, item.h].every(isInt)) {
      problems.push(`${at}: position and size must be whole numbers`);
      return;
    }
    if (item.w < LAYOUT_LIMITS.minW || item.w > GRID_COLUMNS || item.h < minHeightOf(item.type) || item.h > LAYOUT_LIMITS.maxH) problems.push(`${at}: size out of range`);
    if (item.tabs !== undefined && item.tabs !== null) {
      const tabs = item.tabs;
      if (!Array.isArray(tabs) || tabs.length > LAYOUT_LIMITS.tabsMax) problems.push(`${at}: at most ${LAYOUT_LIMITS.tabsMax} stacked tabs`);
      else if (!canStack(item.type) || tabs.some((tab) => typeof tab !== 'string' || !types.includes(tab) || !canStack(tab) || tab === item.type) || new Set(tabs).size !== tabs.length) {
        problems.push(`${at}: stacked tabs must be other blocks of this page, each once`);
      }
    }
    if (item.x < 0 || item.y < 0 || item.x + item.w > GRID_COLUMNS || item.y > LAYOUT_LIMITS.maxRow) problems.push(`${at}: outside the grid`);
    if (item.config !== undefined && item.config !== null) {
      if (typeof item.config !== 'object' || Array.isArray(item.config)) problems.push(`${at}: settings must be an object`);
      else for (const problem of validateBlockConfig(pageKey, item.type, item.config)) problems.push(`${at}: ${problem}`);
    }
  });
  if (problems.length === 0) {
    for (let i = 0; i < items.length; i++) {
      for (let j = i + 1; j < items.length; j++) {
        if (overlaps(items[i]!, items[j]!)) {
          problems.push(`Blocks ${i + 1} and ${j + 1} overlap`);
        }
      }
    }
  }
  return problems.slice(0, 10);
}

/* Named dashboards: extra tabs on Home, each with its own block layout. */

/** Who can see a dashboard: its owner, one department (a team) or the workspace. Only its owner can change it. */
export const DASHBOARD_VISIBILITIES = ['private', 'department', 'workspace'] as const;
export type DashboardVisibility = (typeof DASHBOARD_VISIBILITIES)[number];

export const DASHBOARD_LIMITS = { perOwner: 20, nameMax: 60 } as const;

/** Ready-made date ranges a dashboard can show its hours for; a named dashboard remembers one. */
export const DASHBOARD_PERIODS = ['this_week', 'last_week', 'this_month', 'last_month', 'last_30', 'this_year'] as const;
export type PresetPeriod = (typeof DASHBOARD_PERIODS)[number];
/** A range of whole days picked by hand, both ends included: `custom:2026-10-01..2026-10-31`. */
export type CustomPeriod = `custom:${string}..${string}`;
export type DashboardPeriod = PresetPeriod | CustomPeriod;

/** The longest custom range, in days: a year, well inside the dashboard query's own cap. */
export const CUSTOM_PERIOD_DAYS_MAX = 366;
const CUSTOM_PERIOD = /^custom:(\d{4}-\d{2}-\d{2})\.\.(\d{4}-\d{2}-\d{2})$/;

/** A calendar day as written, or null if it isn't one (2026-02-30 isn't). */
function dayNumber(day: string): number | null {
  const [year, month, date] = day.split('-').map(Number) as [number, number, number];
  const value = Date.UTC(year, month - 1, date);
  const back = new Date(value);
  return back.getUTCFullYear() === year && back.getUTCMonth() === month - 1 && back.getUTCDate() === date ? value / 86_400_000 : null;
}

export function customPeriod(from: string, to: string): CustomPeriod {
  return `custom:${from}..${to}`;
}

/** The days of a custom range, or null when it isn't one, its days aren't real, it runs backwards or it's too long. */
export function parseCustomPeriod(period: string): { from: string; to: string; days: number } | null {
  const match = CUSTOM_PERIOD.exec(period);
  if (!match) return null;
  const [, from, to] = match as unknown as [string, string, string];
  const start = dayNumber(from);
  const end = dayNumber(to);
  if (start === null || end === null || end < start || end - start + 1 > CUSTOM_PERIOD_DAYS_MAX) return null;
  return { from, to, days: end - start + 1 };
}

export function isDashboardPeriod(value: unknown): value is DashboardPeriod {
  return typeof value === 'string' && ((DASHBOARD_PERIODS as readonly string[]).includes(value) || parseCustomPeriod(value) !== null);
}

export interface NamedDashboardResponse {
  id: string;
  name: string;
  visibility: DashboardVisibility;
  ownerId: string;
  /** True when the signed-in user owns it (and so may edit, share or delete it). */
  mine: boolean;
  version: number;
  items: LayoutItem[];
  /** The date range it opens with, set by the owner; null means the page's own. */
  period: DashboardPeriod | null;
  /** The team it's shared with, when visibility is "department"; null if that department was deleted. */
  departmentId: string | null;
  departmentName: string | null;
  updatedAt: string;
}

/** A department the signed-in user belongs to or heads: a team they can share a dashboard with. */
export interface DashboardTeam {
  id: string;
  name: string;
}

/** Just the stored fields of an item: position, size and any non-empty settings. */
export function cleanLayoutItem({ id, type, x, y, w, h, config, tabs }: LayoutItem): LayoutItem {
  const settings = cleanBlockConfig(config);
  return { id, type, x, y, w, h, ...(settings ? { config: settings } : {}), ...(tabs?.length ? { tabs: [...tabs] } : {}) };
}

/** How many past saves of a page a person can go back to. */
export const LAYOUT_VERSIONS_KEPT = 20;

/** The arrangement a workspace starts everyone on, set by someone with layout.manage. */
export interface WorkspaceLayout {
  pageKey: LayoutPage;
  items: LayoutItem[];
  updatedAt: string;
  updatedByName: string | null;
  /** Locked: everyone sees this layout; only people with layout.manage arrange the page. */
  locked: boolean;
}

export interface LayoutVersion {
  version: number;
  savedAt: string;
  items: LayoutItem[];
}
