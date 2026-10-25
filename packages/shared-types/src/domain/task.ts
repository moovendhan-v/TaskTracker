export const TASK_STATUSES = ['todo', 'in_progress', 'in_review', 'done'] as const;
export type TaskStatus = (typeof TASK_STATUSES)[number];

export const TASK_PRIORITIES = ['urgent', 'high', 'normal', 'low', 'none'] as const;
export type TaskPriority = (typeof TASK_PRIORITIES)[number];

export const TASK_TITLE_MAX = 200;
export const TASK_DESCRIPTION_MAX = 10_000;

/** Free-form key/value data on a task, e.g. an order id from another system. Filterable as `metadata.<key>`. */
export type TaskMetadata = Record<string, string | number | boolean | null>;

export const METADATA_LIMITS = { maxKeys: 50, maxValueLength: 500 } as const;
