import type { SprintTaskRow } from './sprint-report.js';
import type { NewSprint, Sprint, SprintWithCounts } from './sprint.js';

export abstract class SprintRepository {
  /** Newest first, with task counts. */
  abstract listInSpace(workspaceId: string, spaceId: string): Promise<SprintWithCounts[]>;
  abstract findInWorkspace(workspaceId: string, sprintId: string): Promise<SprintWithCounts | null>;
  abstract hasActiveSprint(workspaceId: string, spaceId: string): Promise<boolean>;
  abstract create(sprint: NewSprint): Promise<Sprint>;
  abstract save(sprint: Sprint): Promise<Sprint>;
  abstract delete(workspaceId: string, sprintId: string): Promise<void>;
  /** Moves every task in the sprint that isn't done; returns how many moved. */
  abstract moveOpenTasks(workspaceId: string, fromSprintId: string, toSprintId: string | null): Promise<number>;
  /** Moves the listed tasks, but only those still open in `fromSprintId`; returns how many moved. */
  abstract moveTasks(workspaceId: string, fromSprintId: string, taskIds: readonly string[], toSprintId: string | null): Promise<number>;
  /** Copies the sprint's tasks as they are now into its snapshot for this phase (once per phase). */
  abstract snapshot(workspaceId: string, sprintId: string, phase: 'start' | 'end'): Promise<void>;
  /** After completion moved unfinished work: notes where each task in the end snapshot went. */
  abstract noteDestinations(workspaceId: string, sprintId: string): Promise<void>;
  /** A phase's snapshot (empty when none was taken, or the sprint was empty then). */
  abstract snapshotRows(workspaceId: string, sprintId: string, phase: 'start' | 'end'): Promise<SprintTaskRow[]>;
  /** The sprint's tasks as they are now. */
  abstract currentRows(workspaceId: string, sprintId: string): Promise<SprintTaskRow[]>;
}
