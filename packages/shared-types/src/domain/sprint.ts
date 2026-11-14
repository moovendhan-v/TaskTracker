export const SPRINT_STATUSES = ['planned', 'active', 'completed'] as const;
export type SprintStatus = (typeof SPRINT_STATUSES)[number];

/** How one task fared in a sprint report. */
export const SPRINT_REPORT_OUTCOMES = ['done', 'cancelled', 'open'] as const;

export const SPRINT_GOAL_MAX = 500;
/** Longest sprint allowed, in days. */
export const SPRINT_MAX_DAYS = 90;
