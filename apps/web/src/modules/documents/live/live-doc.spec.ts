import { describe, expect, it } from 'vitest';
import { diff, mapIndex } from './live-doc';

describe('diff', () => {
  it('finds the one changed region', () => {
    expect(diff('Hello world', 'Hello brave world')).toEqual({ start: 6, removed: 0, inserted: 'brave ' });
    expect(diff('Hello brave world', 'Hello world')).toEqual({ start: 6, removed: 6, inserted: '' });
    expect(diff('abc', 'axc')).toEqual({ start: 1, removed: 1, inserted: 'x' });
    expect(diff('same', 'same')).toEqual({ start: 4, removed: 0, inserted: '' });
  });
});

describe('mapIndex', () => {
  it('moves a caret along with text inserted before it', () => {
    expect(mapIndex(5, [{ insert: 'ab' }])).toBe(7);
    expect(mapIndex(5, [{ retain: 2 }, { insert: 'ab' }])).toBe(7);
  });

  it('leaves it alone for changes after it', () => {
    expect(mapIndex(5, [{ retain: 8 }, { insert: 'ab' }])).toBe(5);
    expect(mapIndex(5, [{ retain: 6 }, { delete: 3 }])).toBe(5);
  });

  it('pulls it back for text deleted before it, and never past the deletion', () => {
    expect(mapIndex(5, [{ delete: 2 }])).toBe(3);
    expect(mapIndex(5, [{ retain: 3 }, { delete: 5 }])).toBe(3);
  });
});
