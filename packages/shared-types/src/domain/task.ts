/**
 * What a status means, whatever a space calls it. Views group and colour by
 * status; reports, sprints and "show closed" use the category.
 */
export const STATUS_CATEGORIES = ['unstarted', 'started', 'review', 'blocked', 'done', 'cancelled'] as const;
export type StatusCategory = (typeof STATUS_CATEGORIES)[number];

/** Categories that mean the work is finished, one way or another. */
export const CLOSED_CATEGORIES: readonly StatusCategory[] = ['done', 'cancelled'];

export function isClosedCategory(category: StatusCategory): boolean {
  return CLOSED_CATEGORIES.includes(category);
}

/** Statuses every new space starts with. Spaces can rename, recolour, reorder, add and remove them. */
export const DEFAULT_STATUSES: readonly { name: string; color: string; category: StatusCategory }[] = [
  { name: 'To do', color: '#0891b2', category: 'unstarted' },
  { name: 'In progress', color: '#c026d3', category: 'started' },
  { name: 'In review', color: '#0ea5e9', category: 'review' },
  { name: 'Blocked', color: '#dc2626', category: 'blocked' },
  { name: 'Done', color: '#16a34a', category: 'done' },
];

export const STATUS_NAME_MAX = 40;
export const STATUSES_PER_SPACE_MAX = 30;

export const TASK_PRIORITIES = ['urgent', 'high', 'normal', 'low', 'none'] as const;
export type TaskPriority = (typeof TASK_PRIORITIES)[number];

export const TASK_TYPES = ['task', 'bug', 'feature', 'phase', 'milestone'] as const;
export type TaskType = (typeof TASK_TYPES)[number];

export const TASK_RELATION_KINDS = ['relates', 'blocks', 'duplicates'] as const;
export type TaskRelationKind = (typeof TASK_RELATION_KINDS)[number];

export const TASK_TITLE_MAX = 200;
export const TASK_DESCRIPTION_MAX = 10_000;
/** Subtasks can nest this deep below a top-level task. */
export const SUBTASK_DEPTH_MAX = 3;
export const ESTIMATE_MINUTES_MAX = 100_000;

/** Free-form key/value data on a task, e.g. an order id from another system. Filterable as `metadata.<key>`. */
export type TaskMetadata = Record<string, string | number | boolean | null>;

export const METADATA_LIMITS = { maxKeys: 50, maxValueLength: 500 } as const;

/** Custom field values on a task or space, keyed by custom field id. */
export type CustomFieldValues = Record<string, string | number | boolean | string[] | null>;

/** Sprint, backlog and subtask views return at most this many tasks; bigger sets go through paged search. */
export const PLANNING_VIEW_LIMIT = 100;
