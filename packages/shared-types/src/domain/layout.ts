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
} as const;

/** Pages that can be arranged, and the blocks each one can hold. */
export const LAYOUT_PAGES = ['home'] as const;
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
] as const;
export type HomeBlockType = (typeof HOME_BLOCK_TYPES)[number];

export const BLOCK_TYPES_BY_PAGE: Record<LayoutPage, readonly string[]> = { home: HOME_BLOCK_TYPES };

export interface LayoutItem {
  /** Stable id of this placed block, unique within the layout. */
  id: string;
  type: string;
  x: number;
  y: number;
  w: number;
  h: number;
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
    if (item.w < LAYOUT_LIMITS.minW || item.w > GRID_COLUMNS || item.h < LAYOUT_LIMITS.minH || item.h > LAYOUT_LIMITS.maxH) problems.push(`${at}: size out of range`);
    if (item.x < 0 || item.y < 0 || item.x + item.w > GRID_COLUMNS || item.y > LAYOUT_LIMITS.maxRow) problems.push(`${at}: outside the grid`);
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

/** Who can see a dashboard. Only its owner can change it either way. */
export const DASHBOARD_VISIBILITIES = ['private', 'workspace'] as const;
export type DashboardVisibility = (typeof DASHBOARD_VISIBILITIES)[number];

export const DASHBOARD_LIMITS = { perOwner: 20, nameMax: 60 } as const;

export interface NamedDashboardResponse {
  id: string;
  name: string;
  visibility: DashboardVisibility;
  ownerId: string;
  /** True when the signed-in user owns it (and so may edit, share or delete it). */
  mine: boolean;
  version: number;
  items: LayoutItem[];
  updatedAt: string;
}
