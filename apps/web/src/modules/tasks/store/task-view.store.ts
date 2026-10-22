import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

export type TaskViewMode = 'list' | 'board';

interface TaskViewState {
  /** View mode remembered per list. */
  viewByList: Record<string, TaskViewMode>;
  collapsedGroups: Record<string, boolean>;
  setView: (listId: string, view: TaskViewMode) => void;
  toggleGroup: (groupKey: string) => void;
}

export const useTaskViewStore = create<TaskViewState>()(
  persist(
    (set) => ({
      viewByList: {},
      collapsedGroups: {},
      setView: (listId, view) => set((state) => ({ viewByList: { ...state.viewByList, [listId]: view } })),
      toggleGroup: (groupKey) =>
        set((state) => ({ collapsedGroups: { ...state.collapsedGroups, [groupKey]: !state.collapsedGroups[groupKey] } })),
    }),
    { name: 'taskflow.task-view', storage: createJSONStorage(() => localStorage) },
  ),
);
