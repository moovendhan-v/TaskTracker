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
  /** Tasks in the sprint when it was completed (before unfinished work moved out); null before then. */
  committedTasks: number | null;
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
  /** Per-task exceptions to that: each listed open task goes to its own sprint (null: backlog). */
  moves?: { taskId: string; sprintId: string | null }[];
}

/** Most per-task destinations one completion can carry. */
export const SPRINT_COMPLETE_MAX_MOVES = 500;
