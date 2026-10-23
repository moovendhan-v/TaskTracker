import type { TaskPriority, TaskStatus } from '../domain/task.js';
import type { PageQuery } from '../domain/pagination.js';

export interface TaskResponse {
  id: string;
  listId: string;
  title: string;
  description: string;
  status: TaskStatus;
  priority: TaskPriority;
  dueDate: string | null;
  assigneeId: string | null;
  /** Sprint the task is planned into; null when it's in the backlog. */
  sprintId: string | null;
  position: number;
  createdAt: string;
  updatedAt: string;
}

export interface CreateTaskRequest {
  title: string;
  description?: string;
  status?: TaskStatus;
  priority?: TaskPriority;
  dueDate?: string | null;
  assigneeId?: string | null;
}

export interface UpdateTaskRequest extends Partial<CreateTaskRequest> {
  position?: number;
  /** Planning a task into a sprint needs sprint.manage. */
  sprintId?: string | null;
}

export interface TaskQuery extends PageQuery {
  status?: TaskStatus;
  search?: string;
}
