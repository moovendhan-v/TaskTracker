import { TASK_PRIORITIES, type TaskPriority, type TaskResponse, type TaskStatusResponse } from '@taskflow/shared-types';

export const GROUP_BY = ['status', 'assignee', 'priority', 'none'] as const;
export type GroupBy = (typeof GROUP_BY)[number];

export interface TaskGroup {
  key: string;
  label: string;
  /** Status groups carry their status, so quick-add can create tasks in it. */
  status?: TaskStatusResponse;
  priority?: TaskPriority;
  assigneeId?: string | null;
  tasks: TaskResponse[];
}

/**
 * Splits tasks into the groups a list view shows. Status groups follow the
 * space's workflow and always appear (so each has its "Add task" row); other
 * groupings show only groups that have tasks.
 */
export function groupTasks(
  tasks: readonly TaskResponse[],
  by: GroupBy,
  statuses: readonly TaskStatusResponse[],
  memberName: (userId: string | null) => string | null,
): TaskGroup[] {
  const byPosition = (a: TaskResponse, b: TaskResponse) => a.position - b.position;
  if (by === 'none') return [{ key: 'all', label: 'All tasks', tasks: [...tasks].sort(byPosition) }];
  if (by === 'status') {
    return statuses.map((status) => ({ key: status.id, label: status.name, status, tasks: tasks.filter((task) => task.statusId === status.id).sort(byPosition) }));
  }
  if (by === 'priority') {
    return TASK_PRIORITIES.map((priority) => ({ key: priority, label: priority === 'none' ? 'No priority' : priority[0]!.toUpperCase() + priority.slice(1), priority, tasks: tasks.filter((task) => task.priority === priority).sort(byPosition) })).filter(
      (group) => group.tasks.length > 0,
    );
  }
  const groups = new Map<string, TaskGroup>();
  for (const task of tasks) {
    const key = task.assigneeId ?? 'unassigned';
    const group = groups.get(key) ?? { key, label: task.assigneeId ? (memberName(task.assigneeId) ?? 'Former member') : 'Unassigned', assigneeId: task.assigneeId, tasks: [] };
    group.tasks.push(task);
    groups.set(key, group);
  }
  return [...groups.values()].map((group) => ({ ...group, tasks: group.tasks.sort(byPosition) })).sort((a, b) => (a.key === 'unassigned' ? 1 : b.key === 'unassigned' ? -1 : a.label.localeCompare(b.label)));
}
