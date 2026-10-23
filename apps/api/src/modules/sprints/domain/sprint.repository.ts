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
}
