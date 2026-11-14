import { describe, expect, it } from 'vitest';
import { neighbours, useTaskSequenceStore } from './task-sequence.store';

describe('task order for the preview', () => {
  it('finds the tasks either side', () => {
    expect(neighbours(['a', 'b', 'c'], 'b')).toEqual({ index: 1, total: 3, previous: 'a', next: 'c' });
    expect(neighbours(['a', 'b', 'c'], 'a')).toEqual({ index: 0, total: 3, previous: null, next: 'b' });
    expect(neighbours(['a', 'b', 'c'], 'c').next).toBeNull();
    expect(neighbours(['a', 'b'], 'zzz')).toEqual({ index: -1, total: 2, previous: null, next: null });
    expect(neighbours(['a'], undefined).index).toBe(-1);
  });

  it('lets a view clear only the order it set', () => {
    const first = Symbol('first');
    const second = Symbol('second');
    const store = useTaskSequenceStore.getState();
    store.set(first, ['a']);
    store.set(second, ['b']);
    useTaskSequenceStore.getState().clear(first);
    expect(useTaskSequenceStore.getState().ids).toEqual(['b']);
    useTaskSequenceStore.getState().clear(second);
    expect(useTaskSequenceStore.getState().ids).toEqual([]);
  });
});
