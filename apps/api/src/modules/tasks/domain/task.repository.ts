import type { NormalizedQuery } from '../../../core/query/normalize-query.js';
import type { NewTask, Task } from './task.js';

export interface TaskPage {
  items: Task[];
  total: number;
}

/** Fixed limits a view puts on a search, on top of the user's filters. */
export interface TaskSearchScope {
  listId?: string;
  spaceId?: string;
}

export abstract class TaskRepository {
  abstract findInWorkspace(workspaceId: string, taskId: string): Promise<Task | null>;
  abstract findByNumber(workspaceId: string, number: number): Promise<Task | null>;
  /** Tasks by id in the workspace; missing ids are left out. */
  abstract findMany(workspaceId: string, taskIds: readonly string[]): Promise<Task[]>;
  /** Highest position in the list, or 0 when it's empty. */
  abstract maxPosition(workspaceId: string, listId: string): Promise<number>;
  /** Tasks planned into a sprint, across every list in its space. */
  abstract listInSprint(workspaceId: string, sprintId: string, limit: number): Promise<Task[]>;
  /** Unfinished tasks in a space's lists that aren't in any sprint. */
  abstract backlogInSpace(workspaceId: string, spaceId: string, limit: number): Promise<Task[]>;
  /** One page of tasks matching a validated resource query, within the scope. */
  abstract search(workspaceId: string, scope: TaskSearchScope, query: NormalizedQuery): Promise<TaskPage>;
  /** The next number in the workspace's sequence; locks the counter until the transaction ends. */
  abstract nextNumber(workspaceId: string): Promise<number>;
  /** How many direct subtasks each task has. */
  abstract countSubtasks(workspaceId: string, taskIds: readonly string[]): Promise<Map<string, number>>;
  /** Direct subtasks, in position order. */
  abstract listSubtasks(workspaceId: string, parentId: string, limit: number): Promise<Task[]>;
  /** How many ancestors a task has (0 for a top-level task). */
  abstract depthOf(workspaceId: string, taskId: string): Promise<number>;
  abstract create(task: NewTask): Promise<Task>;
  abstract save(task: Task): Promise<Task>;
  abstract delete(workspaceId: string, taskId: string): Promise<void>;
}
