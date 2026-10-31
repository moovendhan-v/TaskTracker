import { DEFAULT_LAYOUTS, validateLayoutItems, type LayoutItem } from '@taskflow/shared-types';
import { describe, expect, it } from 'vitest';

const item = (patch: Partial<LayoutItem> = {}): LayoutItem => ({ id: 'a', type: 'status', x: 0, y: 0, w: 4, h: 4, ...patch });

describe('validateLayoutItems', () => {
  it('accepts the built-in default', () => {
    expect(validateLayoutItems('home', DEFAULT_LAYOUTS.home)).toEqual([]);
  });

  it('rejects unknown types, bad ids and duplicates', () => {
    expect(validateLayoutItems('home', [item({ type: 'shell' })])).toEqual(['Block 1: unknown block type']);
    expect(validateLayoutItems('home', [item({ id: 'A B' })])).toEqual(['Block 1: invalid id']);
    expect(validateLayoutItems('home', [item(), item({ x: 6 })])).toEqual(['Block 2: duplicate id']);
  });

  it('keeps blocks on the grid, sized within limits, without overlaps', () => {
    expect(validateLayoutItems('home', [item({ x: 10, w: 4 })])).toEqual(['Block 1: outside the grid']);
    expect(validateLayoutItems('home', [item({ w: 1 })])).toEqual(['Block 1: size out of range']);
    expect(validateLayoutItems('home', [item({ x: 0.5 })])).toEqual(['Block 1: position and size must be whole numbers']);
    expect(validateLayoutItems('home', [item(), item({ id: 'b', x: 2 })])).toEqual(['Blocks 1 and 2 overlap']);
  });

  it('caps the number of blocks', () => {
    const many = Array.from({ length: 41 }, (_, i) => item({ id: `b${i}`, y: i * 4 }));
    expect(validateLayoutItems('home', many)).toContain('At most 40 blocks');
  });
});
