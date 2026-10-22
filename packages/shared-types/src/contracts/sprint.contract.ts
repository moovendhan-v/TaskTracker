import type { SprintStatus } from '../domain/sprint.js';

export interface SprintResponse {
  id: string;
  spaceId: string;
  name: string;
  goal: string;
  /** yyyy-mm-dd */
  startDate: string;
  /** yyyy-mm-dd */
  endDate: string;
  status: SprintStatus;
  totalTasks: number;
  doneTasks: number;
  completedAt: string | null;
}

export interface CreateSprintRequest {
  name: string;
  goal?: string;
  startDate: string;
  endDate: string;
}

export type UpdateSprintRequest = Partial<CreateSprintRequest>;

export interface CompleteSprintRequest {
  /** Where unfinished tasks go: another planned sprint in the same space, or null for the backlog. */
  moveOpenTasksToSprintId: string | null;
}
