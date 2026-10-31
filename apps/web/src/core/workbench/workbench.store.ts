import type { WorkspaceTab } from '@taskflow/shared-types';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { fromStored, type TabsState } from './tabs';

interface WorkbenchState extends TabsState {
  /** True once the server's tabs have been read; until then navigation doesn't touch tabs. */
  hydrated: boolean;
  hydrate: (tabs: readonly WorkspaceTab[]) => void;
  apply: (change: (state: TabsState) => TabsState) => void;
  rename: (tabId: string, title: string) => void;
}

/**
 * Open tabs. The list itself is saved to the account (preferences.tabs, see
 * useWorkbenchSync); which tab is active is remembered per browser only.
 */
export const useWorkbenchStore = create<WorkbenchState>()(
  persist(
    (set) => ({
      tabs: [],
      active: {},
      hydrated: false,
      hydrate: (tabs) => set((state) => (state.hydrated ? state : { tabs: fromStored(tabs), hydrated: true })),
      apply: (change) =>
        set((state) => {
          const next = change({ tabs: state.tabs, active: state.active });
          return next.tabs === state.tabs && next.active === state.active ? state : next;
        }),
      rename: (tabId, title) =>
        set((state) => (state.tabs.some((tab) => tab.id === tabId && tab.title !== title) ? { tabs: state.tabs.map((tab) => (tab.id === tabId ? { ...tab, title } : tab)) } : state)),
    }),
    { name: 'taskflow.workbench', storage: createJSONStorage(() => localStorage), partialize: (state) => ({ active: state.active }) },
  ),
);
