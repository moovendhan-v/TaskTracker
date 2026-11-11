import { describe, expect, it } from 'vitest';
import { CATEGORICAL, foldSlices, slicePath } from './charts';

const slices = (values: number[]) => values.map((value, index) => ({ key: `s${index}`, label: `S${index}`, value }));

describe('foldSlices', () => {
  it('drops empty slices and gives the rest the slots in order', () => {
    expect(foldSlices(slices([3, 0, 2])).map((slice) => [slice.key, slice.color])).toEqual([
      ['s0', CATEGORICAL[0]],
      ['s2', CATEGORICAL[1]],
    ]);
  });

  it('keeps an entity colour when it has one', () => {
    expect(foldSlices([{ key: 'done', label: 'Done', value: 2, color: '#123456' }])[0]?.color).toBe('#123456');
  });

  it('folds everything past the six largest into one grey Other, keeping the others in order', () => {
    const folded = foldSlices(slices([1, 9, 2, 8, 3, 7, 4, 6]));
    expect(folded.map((slice) => slice.key)).toEqual(['s1', 's3', 's4', 's5', 's6', 's7', '__other']);
    expect(folded.at(-1)).toMatchObject({ label: 'Other (2)', value: 3, color: 'var(--chart-other)' });
    // No two visible slices share a colour.
    const colours = folded.map((slice) => slice.color);
    expect(new Set(colours).size).toBe(colours.length);
  });

  it("doesn't fold a single slice past the limit into a lonely Other", () => {
    expect(foldSlices(slices([1, 2, 3, 4, 5, 6, 7])).map((slice) => slice.key)).not.toContain('__other');
  });
});

describe('slicePath', () => {
  it('draws a wedge to the centre for a pie, and a ring segment for a donut', () => {
    expect(slicePath(0, 0.25, 10, 0, 10)).toMatch(/^M 10\.000 0\.000 A 10 10 0 0 1 20\.000 10\.000 L 10 10 Z$/);
    expect(slicePath(0, 0.25, 10, 5, 10)).toContain('A 5 5 0 0 0');
  });

  it('uses the large arc past half the circle, and two halves for a full circle', () => {
    expect(slicePath(0, 0.75, 10, 0, 10)).toContain('A 10 10 0 1 1');
    expect(slicePath(0, 1, 10, 0, 10).match(/M /g)).toHaveLength(2);
  });
});
