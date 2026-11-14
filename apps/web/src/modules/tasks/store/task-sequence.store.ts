import { useEffect } from 'react';
import { create } from 'zustand';

interface TaskSequenceState {
  /** The tasks the open view shows, in the order it shows them. */
  ids: string[];
  /** Who set them, so a view that goes away only clears its own. */
  owner: symbol | null;
  set: (owner: symbol, ids: string[]) => void;
  clear: (owner: symbol) => void;
}

/** The order of tasks in the view behind the task preview, for ↑/↓ stepping. Not persisted. */
export const useTaskSequenceStore = create<TaskSequenceState>()((set) => ({
  ids: [],
  owner: null,
  set: (owner, ids) => set({ owner, ids }),
  clear: (owner) => set((state) => (state.owner === owner ? { owner: null, ids: [] } : state)),
}));

/** A view shares the order of the tasks it shows while it's on screen. */
export function useShareTaskOrder(ids: readonly string[]): void {
  const key = ids.join(',');
  useEffect(() => {
    const owner = Symbol('task view');
    useTaskSequenceStore.getState().set(owner, key ? key.split(',') : []);
    return () => useTaskSequenceStore.getState().clear(owner);
  }, [key]);
}

/** Where a task sits in the shared order: its position and the tasks either side (null at the ends or when it isn't in it). */
export function neighbours(ids: readonly string[], taskId: string | undefined): { index: number; total: number; previous: string | null; next: string | null } {
  const index = taskId ? ids.indexOf(taskId) : -1;
  if (index === -1) return { index: -1, total: ids.length, previous: null, next: null };
  return { index, total: ids.length, previous: ids[index - 1] ?? null, next: ids[index + 1] ?? null };
}
