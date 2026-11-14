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
  /** Story points in the sprint when it was completed; null until then. */
  committedPoints: number | null;
  /** When it was started; null while planned (and for sprints started before this was kept). */
  startedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export type NewSprint = Pick<Sprint, 'workspaceId' | 'spaceId' | 'name' | 'goal' | 'startDate' | 'endDate'>;

export interface SprintWithCounts extends Sprint {
  totalTasks: number;
  doneTasks: number;
  /** Story points of the tasks in it now, and of those done. */
  totalPoints: number;
  donePoints: number;
}
