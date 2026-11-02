import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

interface InboxPanelState {
  open: boolean;
  setOpen: (open: boolean) => void;
  toggle: () => void;
}

/** Whether the docked inbox panel is showing. Remembered per browser. */
export const useInboxPanel = create<InboxPanelState>()(
  persist(
    (set) => ({
      open: false,
      setOpen: (open) => set({ open }),
      toggle: () => set((state) => ({ open: !state.open })),
    }),
    { name: 'taskflow.inbox-panel', storage: createJSONStorage(() => localStorage) },
  ),
);
