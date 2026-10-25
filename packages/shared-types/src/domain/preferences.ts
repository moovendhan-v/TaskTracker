import type { FilterNode, SortSpec } from '../query/filter.js';

/** Personal settings, stored on the server so they follow the user to every device. */

export const THEMES = ['system', 'light', 'dark'] as const;
export type Theme = (typeof THEMES)[number];

/** Accent palettes. The web app maps each to its own colour tokens. */
export const ACCENTS = ['violet', 'blue', 'teal', 'green', 'amber', 'orange', 'rose', 'slate'] as const;
export type Accent = (typeof ACCENTS)[number];

export const DENSITIES = ['comfortable', 'compact'] as const;
export type Density = (typeof DENSITIES)[number];

export const TASK_VIEWS = ['list', 'board', 'table', 'calendar', 'timeline', 'planner'] as const;
export type TaskView = (typeof TASK_VIEWS)[number];

/** Where a task opens: a centred modal, a side panel or a full page. */
export const TASK_DETAIL_MODES = ['modal', 'side', 'page'] as const;
export type TaskDetailMode = (typeof TASK_DETAIL_MODES)[number];

export const DATE_FORMATS = ['MM/DD/YYYY', 'DD/MM/YYYY', 'YYYY-MM-DD'] as const;
export type DateFormat = (typeof DATE_FORMATS)[number];

export const TIME_FORMATS = ['12h', '24h'] as const;
export type TimeFormat = (typeof TIME_FORMATS)[number];

export const PREFERENCE_LIMITS = {
  tables: 100,
  savedViews: 100,
  tabs: 20,
  columns: 50,
  nameMax: 60,
  keyMax: 120,
  sidebarWidthMin: 200,
  sidebarWidthMax: 420,
  columnWidthMin: 40,
  columnWidthMax: 1200,
} as const;

/** How a user arranged one table: column order, hidden columns, widths and paging. */
export interface TableLayout {
  /** Which table, e.g. `tasks` or `tasks:list:<id>`. */
  key: string;
  columns: string[];
  hidden: string[];
  widths: { column: string; width: number }[];
  pageSize?: number | null;
  sort?: SortSpec[] | null;
}

/** A saved filter set ("view") for a resource, pinned to the sidebar if wanted. */
export interface SavedView {
  id: string;
  name: string;
  /** Query resource, e.g. `tasks`. */
  resource: string;
  /** Where it applies, e.g. a list or space id; null for everywhere. */
  scope?: string | null;
  where?: string | null;
  filter?: FilterNode | null;
  sort?: SortSpec[] | null;
  columns?: string[] | null;
  pinned: boolean;
  color?: string | null;
}

/** An open tab in the multi-tab workspace. */
export interface WorkspaceTab {
  id: string;
  /** In-app path, e.g. /w/<id>/l/<listId>. */
  path: string;
  title: string;
  pinned: boolean;
}

export interface UserPreferences {
  theme: Theme;
  accent: Accent;
  density: Density;
  sidebarCollapsed: boolean;
  sidebarWidth: number;
  defaultTaskView: TaskView;
  taskDetailMode: TaskDetailMode;
  dateFormat: DateFormat;
  timeFormat: TimeFormat;
  /** 0 = Sunday, 1 = Monday. */
  weekStart: number;
  tables: TableLayout[];
  savedViews: SavedView[];
  tabs: WorkspaceTab[];
}

export const DEFAULT_PREFERENCES: UserPreferences = {
  theme: 'system',
  accent: 'violet',
  density: 'comfortable',
  sidebarCollapsed: false,
  sidebarWidth: 260,
  defaultTaskView: 'list',
  taskDetailMode: 'modal',
  dateFormat: 'MM/DD/YYYY',
  timeFormat: '12h',
  weekStart: 1,
  tables: [],
  savedViews: [],
  tabs: [],
};

/** The simple settings a client can change in one call; collections have their own operations. */
export type PreferenceSettings = Omit<UserPreferences, 'tables' | 'savedViews' | 'tabs'>;

type Stored = Partial<Record<keyof UserPreferences, unknown>>;

const oneOf = <T extends string>(values: readonly T[], value: unknown, fallback: T): T => (values.includes(value as T) ? (value as T) : fallback);
const clamp = (value: unknown, min: number, max: number, fallback: number) =>
  typeof value === 'number' && Number.isFinite(value) ? Math.min(max, Math.max(min, Math.round(value))) : fallback;
const list = <T>(value: unknown, limit: number, keep: (item: Record<string, unknown>) => boolean): T[] =>
  Array.isArray(value) ? (value.filter((item) => item && typeof item === 'object' && keep(item as Record<string, unknown>)).slice(0, limit) as T[]) : [];

/**
 * Reads stored preferences into the current shape: unknown keys are dropped,
 * missing or invalid ones fall back to defaults. Lets the shape grow without
 * migrating rows, and keeps a bad row from breaking anyone's session.
 */
export function readPreferences(stored: unknown): UserPreferences {
  const data: Stored = stored && typeof stored === 'object' ? (stored as Stored) : {};
  const d = DEFAULT_PREFERENCES;
  return {
    theme: oneOf(THEMES, data.theme, d.theme),
    accent: oneOf(ACCENTS, data.accent, d.accent),
    density: oneOf(DENSITIES, data.density, d.density),
    sidebarCollapsed: typeof data.sidebarCollapsed === 'boolean' ? data.sidebarCollapsed : d.sidebarCollapsed,
    sidebarWidth: clamp(data.sidebarWidth, PREFERENCE_LIMITS.sidebarWidthMin, PREFERENCE_LIMITS.sidebarWidthMax, d.sidebarWidth),
    defaultTaskView: oneOf(TASK_VIEWS, data.defaultTaskView, d.defaultTaskView),
    taskDetailMode: oneOf(TASK_DETAIL_MODES, data.taskDetailMode, d.taskDetailMode),
    dateFormat: oneOf(DATE_FORMATS, data.dateFormat, d.dateFormat),
    timeFormat: oneOf(TIME_FORMATS, data.timeFormat, d.timeFormat),
    weekStart: data.weekStart === 0 || data.weekStart === 1 ? data.weekStart : d.weekStart,
    tables: list<TableLayout>(data.tables, PREFERENCE_LIMITS.tables, (item) => typeof item['key'] === 'string'),
    savedViews: list<SavedView>(data.savedViews, PREFERENCE_LIMITS.savedViews, (item) => typeof item['id'] === 'string' && typeof item['resource'] === 'string'),
    tabs: list<WorkspaceTab>(data.tabs, PREFERENCE_LIMITS.tabs, (item) => typeof item['id'] === 'string' && typeof item['path'] === 'string'),
  };
}

