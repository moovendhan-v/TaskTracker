import type { SPRINT_REPORT_OUTCOMES, SprintStatus } from '../domain/sprint.js';

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
  /** Story points of the tasks in it now, and of the done ones (cancelled work doesn't count). */
  totalPoints: number;
  donePoints: number;
  /** Story points in it when it was completed; null before then. */
  committedPoints: number | null;
  /** When it was started; null while planned. */
  startedAt: string | null;
}

/** How one task fared in a sprint. */
export type SprintReportOutcome = (typeof SPRINT_REPORT_OUTCOMES)[number];

export interface SprintReportItem {
  /** Null when the task was deleted since. */
  taskId: string | null;
  number: number;
  title: string;
  points: number | null;
  outcome: SprintReportOutcome;
  /** Planned in after the sprint started. */
  added: boolean;
  /** In the sprint when it started, but taken out before the end. */
  removed: boolean;
  /** Unfinished work at completion: the sprint it moved to, "Backlog", or null when it didn't move. */
  movedTo: string | null;
}

export interface SprintReportTotals {
  tasks: number;
  points: number;
}

/**
 * What a sprint committed to and what it delivered. Live while the sprint is
 * active; fixed once it's completed.
 */
export interface SprintReportResponse {
  sprintId: string;
  name: string;
  goal: string;
  status: SprintStatus;
  startDate: string;
  endDate: string;
  startedAt: string | null;
  completedAt: string | null;
  /** False for sprints started before snapshots were kept: committed and added can't be told apart. */
  hasStartSnapshot: boolean;
  committed: SprintReportTotals;
  completed: SprintReportTotals;
  cancelled: SprintReportTotals;
  notCompleted: SprintReportTotals;
  added: SprintReportTotals;
  removed: SprintReportTotals;
  /** Tasks in it at the end (or now) without story points. */
  unestimated: number;
  items: SprintReportItem[];
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
