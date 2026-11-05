import { GRID_COLUMNS, LAYOUT_LIMITS, minHeightOf, overlaps, type LayoutItem } from '@taskflow/shared-types';

/**
 * Grid rules for arrangeable blocks. One rule does all the work: `arrange`
 * keeps the pinned block where the user put it, then drops every other block,
 * in reading order, into the highest row where it fits in its own columns.
 * That both pushes blocks out of the way and closes gaps ("gravity").
 */

const byReadingOrder = (a: LayoutItem, b: LayoutItem) => a.y - b.y || a.x - b.x;
const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

export function arrange(items: readonly LayoutItem[], pinnedId: string | null = null): LayoutItem[] {
  const pinned = items.find((item) => item.id === pinnedId);
  const placed: LayoutItem[] = pinned ? [pinned] : [];
  for (const item of [...items].filter((item) => item !== pinned).sort(byReadingOrder)) {
    let y = 0;
    let candidate = { ...item, y };
    for (let blocker = placed.find((other) => overlaps(candidate, other)); blocker; blocker = placed.find((other) => overlaps(candidate, other))) {
      y = blocker.y + blocker.h;
      candidate = { ...item, y };
    }
    placed.push(candidate);
  }
  // Keep the caller's order so React keys and focus stay put.
  return items.map((item) => placed.find((other) => other.id === item.id)!);
}

export function moveItem(items: readonly LayoutItem[], id: string, x: number, y: number): LayoutItem[] {
  return arrange(
    items.map((item) => (item.id === id ? { ...item, x: clamp(x, 0, GRID_COLUMNS - item.w), y: clamp(y, 0, LAYOUT_LIMITS.maxRow) } : item)),
    id,
  );
}

export function resizeItem(items: readonly LayoutItem[], id: string, w: number, h: number): LayoutItem[] {
  return arrange(
    items.map((item) =>
      item.id === id ? { ...item, w: clamp(w, LAYOUT_LIMITS.minW, GRID_COLUMNS - item.x), h: clamp(h, minHeightOf(item.type), LAYOUT_LIMITS.maxH) } : item,
    ),
    id,
  );
}

export function removeItem(items: readonly LayoutItem[], id: string): LayoutItem[] {
  return arrange(items.filter((item) => item.id !== id));
}

/** Adds a block in the first gap that fits it (top to bottom, left to right), or at the bottom. */
export function addItem(items: readonly LayoutItem[], item: Omit<LayoutItem, 'x' | 'y'>): LayoutItem[] {
  const bottom = Math.max(0, ...items.map((other) => other.y + other.h));
  const w = Math.min(item.w, GRID_COLUMNS);
  for (let y = 0; y <= bottom; y++) {
    for (let x = 0; x + w <= GRID_COLUMNS; x++) {
      const candidate = { ...item, w, x, y };
      if (!items.some((other) => overlaps(candidate, other))) return arrange([...items, candidate], candidate.id);
    }
  }
  return [...items, { ...item, w, x: 0, y: bottom }];
}

/** Grid rows the layout uses, for sizing the container. */
export function gridHeight(items: readonly LayoutItem[]): number {
  return Math.max(0, ...items.map((item) => item.y + item.h));
}
