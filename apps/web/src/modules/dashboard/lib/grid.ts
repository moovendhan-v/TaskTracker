import { GRID_COLUMNS, LAYOUT_LIMITS, minHeightOf, overlaps, settleLayout, type LayoutItem } from '@taskflow/shared-types';

/**
 * Grid rules for arrangeable blocks. One rule does all the work: `arrange`
 * keeps the moved block where the user put it (and fixed blocks where they are), then drops every other block,
 * in reading order, into the highest row where it fits in its own columns.
 * That both pushes blocks out of the way and closes gaps ("gravity").
 */

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));
const NONE: ReadonlySet<string> = new Set();

/** Blocks that stay put: pinned ones, for people who can't change the workspace default. */
export type FixedIds = ReadonlySet<string>;

export function arrange(items: readonly LayoutItem[], movingId: string | null = null, fixed: FixedIds = NONE): LayoutItem[] {
  return settleLayout(items, { movingId, fixedIds: fixed });
}

export function moveItem(items: readonly LayoutItem[], id: string, x: number, y: number, fixed: FixedIds = NONE): LayoutItem[] {
  if (fixed.has(id)) return [...items];
  return arrange(
    items.map((item) => (item.id === id ? { ...item, x: clamp(x, 0, GRID_COLUMNS - item.w), y: clamp(y, 0, LAYOUT_LIMITS.maxRow) } : item)),
    id,
    fixed,
  );
}

export function resizeItem(items: readonly LayoutItem[], id: string, w: number, h: number, fixed: FixedIds = NONE): LayoutItem[] {
  if (fixed.has(id)) return [...items];
  return arrange(
    items.map((item) =>
      item.id === id ? { ...item, w: clamp(w, LAYOUT_LIMITS.minW, GRID_COLUMNS - item.x), h: clamp(h, minHeightOf(item.type), LAYOUT_LIMITS.maxH) } : item,
    ),
    id,
    fixed,
  );
}

export function removeItem(items: readonly LayoutItem[], id: string, fixed: FixedIds = NONE): LayoutItem[] {
  if (fixed.has(id)) return [...items];
  return arrange(items.filter((item) => item.id !== id), null, fixed);
}

/** Adds a block in the first gap that fits it (top to bottom, left to right), or at the bottom. */
export function addItem(items: readonly LayoutItem[], item: Omit<LayoutItem, 'x' | 'y'>, fixed: FixedIds = NONE): LayoutItem[] {
  const bottom = Math.max(0, ...items.map((other) => other.y + other.h));
  const w = Math.min(item.w, GRID_COLUMNS);
  for (let y = 0; y <= bottom; y++) {
    for (let x = 0; x + w <= GRID_COLUMNS; x++) {
      const candidate = { ...item, w, x, y };
      if (!items.some((other) => overlaps(candidate, other))) return arrange([...items, candidate], candidate.id, fixed);
    }
  }
  return [...items, { ...item, w, x: 0, y: bottom }];
}

/** Grid rows the layout uses, for sizing the container. */
export function gridHeight(items: readonly LayoutItem[]): number {
  return Math.max(0, ...items.map((item) => item.y + item.h));
}
