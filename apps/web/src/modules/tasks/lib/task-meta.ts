import type { TaskPriority, TaskStatus } from '@taskflow/shared-types';
import { TASK_PRIORITIES, TASK_STATUSES } from '@taskflow/shared-types';

interface Meta {
  label: string;
  /** Tailwind classes using the status/priority tokens from globals.css. */
  dot: string;
  text: string;
}

export const STATUS_META: Record<TaskStatus, Meta> = {
  todo: { label: 'To do', dot: 'bg-status-todo', text: 'text-status-todo' },
  in_progress: { label: 'In progress', dot: 'bg-status-in-progress', text: 'text-status-in-progress' },
  in_review: { label: 'In review', dot: 'bg-status-in-review', text: 'text-status-in-review' },
  done: { label: 'Done', dot: 'bg-status-done', text: 'text-status-done' },
};

export const PRIORITY_META: Record<TaskPriority, Meta> = {
  urgent: { label: 'Urgent', dot: 'bg-priority-urgent', text: 'text-priority-urgent' },
  high: { label: 'High', dot: 'bg-priority-high', text: 'text-priority-high' },
  normal: { label: 'Normal', dot: 'bg-priority-normal', text: 'text-priority-normal' },
  low: { label: 'Low', dot: 'bg-priority-low', text: 'text-priority-low' },
  none: { label: 'No priority', dot: 'bg-muted-foreground/40', text: 'text-muted-foreground' },
};

export const STATUS_ORDER = TASK_STATUSES;
export const PRIORITY_ORDER = TASK_PRIORITIES;

export const POSITION_STEP = 1024;

/** Position for a task dropped between two neighbours (either may be missing). */
export function positionBetween(before: number | undefined, after: number | undefined): number {
  if (before === undefined && after === undefined) return POSITION_STEP;
  if (before === undefined) return (after as number) - POSITION_STEP;
  if (after === undefined) return before + POSITION_STEP;
  return (before + after) / 2;
}
