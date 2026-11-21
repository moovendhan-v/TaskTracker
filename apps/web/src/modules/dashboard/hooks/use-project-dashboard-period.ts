import { isDashboardPeriod } from '@taskflow/shared-types';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import type { Period } from '@/lib/periods';

interface ProjectPeriodState {
  bySpace: Record<string, string>;
  set: (spaceId: string, period: Period) => void;
}

/** The range each project's overview dashboard was last looked at with, remembered in this browser. */
const useProjectPeriodStore = create<ProjectPeriodState>()(
  persist(
    (set) => ({
      bySpace: {},
      set: (spaceId, period) => set((state) => ({ bySpace: { ...state.bySpace, [spaceId]: period } })),
    }),
    { name: 'taskflow.project-dashboard-period', storage: createJSONStorage(() => localStorage) },
  ),
);

/** The overview's remembered range for a project (null when none, or one this version no longer reads), and its setter. */
export function useProjectOverviewPeriod(spaceId: string): [Period | null, (period: Period) => void] {
  const stored = useProjectPeriodStore((state) => state.bySpace[spaceId]);
  const set = useProjectPeriodStore((state) => state.set);
  return [isDashboardPeriod(stored) ? stored : null, (period) => set(spaceId, period)];
}
