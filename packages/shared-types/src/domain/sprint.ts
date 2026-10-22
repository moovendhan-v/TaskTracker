export const SPRINT_STATUSES = ['planned', 'active', 'completed'] as const;
export type SprintStatus = (typeof SPRINT_STATUSES)[number];

export const SPRINT_GOAL_MAX = 500;
/** Longest sprint allowed, in days. */
export const SPRINT_MAX_DAYS = 90;
