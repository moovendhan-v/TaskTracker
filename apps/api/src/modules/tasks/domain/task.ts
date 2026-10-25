import type { CustomFieldValues, TaskMetadata, TaskPriority, TaskType } from '@taskflow/shared-types';

export interface Task {
  id: string;
  workspaceId: string;
  /** Short number, unique in the workspace. */
  number: number;
  listId: string;
  parentId: string | null;
  type: TaskType;
  title: string;
  description: string;
  statusId: string;
  priority: TaskPriority;
  startDate: Date | null;
  dueDate: Date | null;
  assigneeId: string | null;
  sprintId: string | null;
  position: number;
  estimateMinutes: number | null;
  progress: number | null;
  metadata: TaskMetadata;
  customFields: CustomFieldValues;
  /** Set when the task enters a closed status (done or cancelled). */
  completedAt: Date | null;
  createdById: string;
  createdAt: Date;
  updatedAt: Date;
}

export type NewTask = Omit<Task, 'id' | 'createdAt' | 'updatedAt'>;

/** Gap between positions so a task can be moved between two others without renumbering. */
export const TASK_POSITION_STEP = 1024;

/** Applies a key/value patch: keys set to null are removed, the rest are set. */
export function mergeValues<T extends Record<string, unknown>>(current: T, patch: Record<string, unknown>): T {
  const next: Record<string, unknown> = { ...current };
  for (const [key, value] of Object.entries(patch)) {
    if (value === null) delete next[key];
    else next[key] = value;
  }
  return next as T;
}

export const mergeMetadata = (current: TaskMetadata, patch: TaskMetadata): TaskMetadata => mergeValues(current, patch);
