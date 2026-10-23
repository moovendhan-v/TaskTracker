import type { TaskPriority, TaskStatus } from '@taskflow/shared-types';

export interface Task {
  id: string;
  workspaceId: string;
  listId: string;
  title: string;
  description: string;
  status: TaskStatus;
  priority: TaskPriority;
  dueDate: Date | null;
  assigneeId: string | null;
  sprintId: string | null;
  position: number;
  createdById: string;
  createdAt: Date;
  updatedAt: Date;
}

export type NewTask = Omit<Task, 'id' | 'createdAt' | 'updatedAt'>;

export interface TaskFilter {
  status?: TaskStatus;
  /** Matched against the title, case-insensitively and literally. */
  search?: string;
}

/** Gap between positions so a task can be moved between two others without renumbering. */
export const TASK_POSITION_STEP = 1024;
