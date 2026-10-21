import type { PageRequest } from '../../../core/http/dto/page-query.dto.js';
import type { NewTask, Task, TaskFilter } from './task.js';

export interface TaskPage {
  items: Task[];
  total: number;
}

export abstract class TaskRepository {
  abstract findInWorkspace(workspaceId: string, taskId: string): Promise<Task | null>;
  /** Ordered by position, then creation time. */
  abstract pageInList(workspaceId: string, listId: string, filter: TaskFilter, page: PageRequest): Promise<TaskPage>;
  /** Highest position in the list, or 0 when it's empty. */
  abstract maxPosition(workspaceId: string, listId: string): Promise<number>;
  abstract create(task: NewTask): Promise<Task>;
  abstract save(task: Task): Promise<Task>;
  abstract delete(workspaceId: string, taskId: string): Promise<void>;
}
