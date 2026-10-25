import type { TaskRelationKind } from '@taskflow/shared-types';
import type { NewTaskActivity, TaskActivity, TaskRelation } from './task-extras.js';

/** Who follows a task, for notifications. */
export abstract class TaskWatcherRepository {
  abstract list(workspaceId: string, taskId: string): Promise<string[]>;
  abstract add(workspaceId: string, taskId: string, userIds: readonly string[]): Promise<void>;
  abstract remove(workspaceId: string, taskId: string, userId: string): Promise<void>;
}

export abstract class TaskRelationRepository {
  /** Relations where the task is either side. */
  abstract listFor(workspaceId: string, taskId: string): Promise<TaskRelation[]>;
  abstract findInWorkspace(workspaceId: string, relationId: string): Promise<TaskRelation | null>;
  /** Returns null when the same relation already exists. */
  abstract create(relation: Omit<TaskRelation, 'id' | 'createdAt'>): Promise<TaskRelation | null>;
  abstract delete(workspaceId: string, relationId: string): Promise<void>;
}

export abstract class TaskActivityRepository {
  abstract record(entries: readonly NewTaskActivity[]): Promise<void>;
  /** Newest first. */
  abstract list(workspaceId: string, taskId: string, limit: number): Promise<TaskActivity[]>;
}

export type { TaskRelationKind };
