import type { SprintStatus } from '@taskflow/shared-types';

export interface Sprint {
  id: string;
  workspaceId: string;
  spaceId: string;
  name: string;
  goal: string;
  /** yyyy-mm-dd */
  startDate: string;
  /** yyyy-mm-dd */
  endDate: string;
  status: SprintStatus;
  completedAt: Date | null;
  /** Tasks in the sprint when it was completed, before unfinished work moved out; null until then. */
  committedTasks: number | null;
  createdAt: Date;
  updatedAt: Date;
}

export type NewSprint = Pick<Sprint, 'workspaceId' | 'spaceId' | 'name' | 'goal' | 'startDate' | 'endDate'>;

export interface SprintWithCounts extends Sprint {
  totalTasks: number;
  doneTasks: number;
}
