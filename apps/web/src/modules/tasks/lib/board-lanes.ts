import { TASK_TYPES, type TaskPriority, type TaskResponse, type TaskType } from '@taskflow/shared-types';
import { groupTasks } from './group-tasks';
import { TYPE_META } from './task-meta';

export const SWIMLANES = ['none', 'assignee', 'priority', 'type'] as const;
export type Swimlane = (typeof SWIMLANES)[number];

export const SWIMLANE_LABELS: Record<Swimlane, string> = { none: 'None', assignee: 'Assignee', priority: 'Priority', type: 'Type' };

/** One row of the board: its tasks, and what dropping a card into it sets. */
export interface Lane {
  key: string;
  label: string;
  tasks: TaskResponse[];
  /** The change a card dropped into this lane gets, besides its status. */
  sets: { assigneeId?: string | null; priority?: TaskPriority; type?: TaskType };
}

/** Splits board tasks into lanes; only lanes with tasks show. 'none' is one lane with everything. */
export function boardLanes(tasks: readonly TaskResponse[], by: Swimlane, memberName: (userId: string | null) => string | null): Lane[] {
  if (by === 'none') return [{ key: 'all', label: 'All', tasks: [...tasks], sets: {} }];
  if (by === 'type') {
    return TASK_TYPES.map((type) => ({ key: type, label: TYPE_META[type].label, tasks: tasks.filter((task) => task.type === type), sets: { type } })).filter((lane) => lane.tasks.length > 0);
  }
  return groupTasks(tasks, by, [], memberName).map((group) => ({
    key: group.key,
    label: group.label,
    tasks: group.tasks,
    sets: by === 'priority' ? { priority: group.priority! } : { assigneeId: group.assigneeId ?? null },
  }));
}

/** What a column's work-in-progress limit says: nothing set, room left, at it, or over it. */
export type WipState = 'none' | 'under' | 'at' | 'over';

export function wipState(count: number, limit: number | null): WipState {
  if (limit === null) return 'none';
  return count > limit ? 'over' : count === limit ? 'at' : 'under';
}
