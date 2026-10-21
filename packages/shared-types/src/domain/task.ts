export const TASK_STATUSES = ['todo', 'in_progress', 'in_review', 'done'] as const;
export type TaskStatus = (typeof TASK_STATUSES)[number];

export const TASK_PRIORITIES = ['urgent', 'high', 'normal', 'low', 'none'] as const;
export type TaskPriority = (typeof TASK_PRIORITIES)[number];

export const TASK_TITLE_MAX = 200;
export const TASK_DESCRIPTION_MAX = 10_000;
