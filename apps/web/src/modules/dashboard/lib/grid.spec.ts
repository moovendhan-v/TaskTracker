import { DEFAULT_LAYOUTS, validateLayoutItems, type LayoutItem } from '@taskflow/shared-types';
import { describe, expect, it } from 'vitest';
import { addItem, arrange, moveItem, removeItem, resizeItem } from './grid';

const b = (id: string, x: number, y: number, w = 4, h = 2): LayoutItem => ({ id, type: 'status', x, y, w, h });
const pos = (items: LayoutItem[]) => Object.fromEntries(items.map((item) => [item.id, [item.x, item.y, item.w, item.h]]));

describe('grid', () => {
  it('floats blocks up into gaps', () => {
    expect(pos(arrange([b('a', 0, 5), b('b', 4, 9)]))).toEqual({ a: [0, 0, 4, 2], b: [4, 0, 4, 2] });
    expect(pos(arrange([b('a', 0, 0), b('b', 0, 7)]))).toEqual({ a: [0, 0, 4, 2], b: [0, 2, 4, 2] });
  });

  it('pushes blocks out of the way of a moved block, which stays where it was dropped', () => {
    const items = [b('a', 0, 0), b('b', 0, 2), b('c', 4, 0)];
    expect(pos(moveItem(items, 'c', 0, 0))).toEqual({ a: [0, 2, 4, 2], b: [0, 4, 4, 2], c: [0, 0, 4, 2] });
  });

  it('keeps blocks inside the grid and within size limits', () => {
    expect(pos(moveItem([b('a', 0, 0)], 'a', 11, -3))).toEqual({ a: [8, 0, 4, 2] });
    expect(pos(resizeItem([b('a', 6, 0)], 'a', 20, 99))).toEqual({ a: [6, 0, 6, 16] });
    expect(pos(resizeItem([b('a', 0, 0)], 'a', 0, 0))).toEqual({ a: [0, 0, 2, 2] });
  });

  it('pushes neighbours down when a block grows into them', () => {
    expect(pos(resizeItem([b('a', 0, 0), b('b', 4, 0)], 'a', 6, 2))).toEqual({ a: [0, 0, 6, 2], b: [4, 2, 4, 2] });
  });

  it('adds a block in the first gap, and closes the gap on remove', () => {
    const items = [b('a', 0, 0), b('b', 8, 0)];
    expect(pos(addItem(items, { id: 'c', type: 'status', w: 4, h: 2 })).c).toEqual([4, 0, 4, 2]);
    expect(pos(removeItem([b('a', 0, 0, 12), b('b', 0, 2)], 'a'))).toEqual({ b: [0, 0, 4, 2] });
  });

  it('always produces layouts the server accepts', () => {
    let items = DEFAULT_LAYOUTS.home;
    items = moveItem(items, 'recent-tasks', 3, 0);
    items = resizeItem(items, 'status', 12, 9);
    items = removeItem(items, 'priority');
    items = addItem(items, { id: 'priority', type: 'priority', w: 4, h: 5 });
    expect(validateLayoutItems('home', items)).toEqual([]);
  });
});

describe('pinned (fixed) blocks', () => {
  const pinned = { id: 'status', type: 'status', x: 0, y: 0, w: 12, h: 4, pinned: true };
  const other = { id: 'priority', type: 'priority', x: 0, y: 4, w: 6, h: 5 };
  const fixed = new Set(['status']);

  it("don't move, resize or go", () => {
    expect(moveItem([pinned, other], 'status', 6, 8, fixed)).toEqual([pinned, other]);
    expect(resizeItem([pinned, other], 'status', 6, 4, fixed)).toEqual([pinned, other]);
    expect(removeItem([pinned, other], 'status', fixed)).toEqual([pinned, other]);
  });

  it('push the others out of their way instead', () => {
    const [stayed, pushed] = moveItem([pinned, other], 'priority', 0, 0, fixed);
    expect(stayed).toEqual(pinned);
    expect(pushed).toMatchObject({ id: 'priority', y: 4 });
  });
});
