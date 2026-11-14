import { isClosedCategory, STORY_POINTS_MAX, TASK_PRIORITIES, type TaskPriority, type TaskResponse, type TaskType } from '@taskflow/shared-types';

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

/** Task types as small labels; the background is a fixed, readable tint per type. */
export const TYPE_META: Record<TaskType, { label: string; className: string }> = {
  task: { label: 'Task', className: 'bg-chart-1/25 text-foreground' },
  bug: { label: 'Bug', className: 'bg-critical/25 text-foreground' },
  feature: { label: 'Feature', className: 'bg-good/25 text-foreground' },
  phase: { label: 'Phase', className: 'bg-chart-2/30 text-foreground' },
  milestone: { label: 'Milestone', className: 'bg-warning/30 text-foreground' },
};

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

/** What someone typed as story points: a whole number 0–100, or null for empty (or nonsense). */
export function parseStoryPoints(value: string): number | null {
  if (value.trim() === '') return null;
  const number = Number(value);
  if (!Number.isFinite(number)) return null;
  return Math.max(0, Math.min(STORY_POINTS_MAX, Math.round(number)));
}

/** "5 pts", "1 pt". */
export const formatPoints = (points: number) => `${points} ${points === 1 ? 'pt' : 'pts'}`;
