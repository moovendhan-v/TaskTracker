import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

interface WorkspaceUiState {
  lastWorkspaceId: string | null;
  sidebarOpen: boolean;
  setLastWorkspaceId: (workspaceId: string | null) => void;
  toggleSidebar: () => void;
}

/** UI preferences only. Remembered per browser; never the source of truth for access. */
export const useWorkspaceUiStore = create<WorkspaceUiState>()(
  persist(
    (set) => ({
      lastWorkspaceId: null,
      sidebarOpen: true,
      setLastWorkspaceId: (lastWorkspaceId) => set({ lastWorkspaceId }),
      toggleSidebar: () => set((state) => ({ sidebarOpen: !state.sidebarOpen })),
    }),
    { name: 'taskflow.workspace-ui', storage: createJSONStorage(() => localStorage) },
  ),
);
