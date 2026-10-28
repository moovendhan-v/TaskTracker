import type { NewTaskStatus, TaskStatus } from './task-status.js';

export abstract class TaskStatusRepository {
  /** In display order. */
  abstract listForSpace(workspaceId: string, spaceId: string): Promise<TaskStatus[]>;
  abstract listForWorkspace(workspaceId: string): Promise<TaskStatus[]>;
  abstract findInWorkspace(workspaceId: string, statusId: string): Promise<TaskStatus | null>;
  abstract createMany(statuses: NewTaskStatus[]): Promise<TaskStatus[]>;
  abstract save(status: TaskStatus): Promise<TaskStatus>;
  abstract delete(workspaceId: string, statusId: string): Promise<void>;
  abstract setPositions(workspaceId: string, orderedIds: readonly string[]): Promise<void>;
  /** Moves every task in one status to another; returns how many moved. */
  abstract countTasks(workspaceId: string, statusId: string): Promise<number>;
  abstract moveTasks(workspaceId: string, fromStatusId: string, toStatusId: string): Promise<number>;
}
