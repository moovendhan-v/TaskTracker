import { isClosedCategory, TASK_PRIORITIES, type TaskPriority, type TaskResponse } from '@taskflow/shared-types';

interface Meta {
  label: string;
  /** Tailwind classes using the priority tokens from globals.css. */
  dot: string;
  text: string;
}

export const PRIORITY_META: Record<TaskPriority, Meta> = {
  urgent: { label: 'Urgent', dot: 'bg-priority-urgent', text: 'text-priority-urgent' },
  high: { label: 'High', dot: 'bg-priority-high', text: 'text-priority-high' },
  normal: { label: 'Normal', dot: 'bg-priority-normal', text: 'text-priority-normal' },
  low: { label: 'Low', dot: 'bg-priority-low', text: 'text-priority-low' },
  none: { label: 'No priority', dot: 'bg-muted-foreground/40', text: 'text-muted-foreground' },
};

export const PRIORITY_ORDER = TASK_PRIORITIES;

/** Done or cancelled: shown struck through and left out of overdue warnings. */
export function isClosed(task: Pick<TaskResponse, 'status'>): boolean {
  return isClosedCategory(task.status.category);
}

export const POSITION_STEP = 1024;

/** Position for a task dropped between two neighbours (either may be missing). */
export function positionBetween(before: number | undefined, after: number | undefined): number {
  if (before === undefined && after === undefined) return POSITION_STEP;
  if (before === undefined) return (after as number) - POSITION_STEP;
  if (after === undefined) return before + POSITION_STEP;
  return (before + after) / 2;
}
