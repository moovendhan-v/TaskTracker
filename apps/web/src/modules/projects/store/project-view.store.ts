import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import type { GroupBy } from '@/modules/tasks';

export interface ProjectViewSettings {
  groupBy: GroupBy;
  showClosed: boolean;
  /** Include subtasks as their own rows. */
  subtasks: boolean;
  /** Only tasks assigned to the signed-in person. */
  mine: boolean;
}

export const DEFAULT_VIEW_SETTINGS: ProjectViewSettings = { groupBy: 'status', showClosed: false, subtasks: true, mine: false };

interface ProjectViewState {
  bySpace: Record<string, ProjectViewSettings>;
  set: (spaceId: string, change: Partial<ProjectViewSettings>) => void;
}

/** Toolbar choices per project, remembered in this browser. */
export const useProjectViewStore = create<ProjectViewState>()(
  persist(
    (set) => ({
      bySpace: {},
      set: (spaceId, change) => set((state) => ({ bySpace: { ...state.bySpace, [spaceId]: { ...DEFAULT_VIEW_SETTINGS, ...state.bySpace[spaceId], ...change } } })),
    }),
    { name: 'taskflow.project-view', storage: createJSONStorage(() => localStorage) },
  ),
);

export function useProjectView(spaceId: string): [ProjectViewSettings, (change: Partial<ProjectViewSettings>) => void] {
  const settings = useProjectViewStore((state) => state.bySpace[spaceId]) ?? DEFAULT_VIEW_SETTINGS;
  const set = useProjectViewStore((state) => state.set);
  return [settings, (change) => set(spaceId, change)];
}
