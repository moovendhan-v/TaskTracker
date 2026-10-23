export const EMPLOYMENT_TYPES = ['full_time', 'part_time', 'contractor', 'intern'] as const;
export type EmploymentType = (typeof EMPLOYMENT_TYPES)[number];

export const LEAVE_STATUSES = ['pending', 'approved', 'rejected', 'cancelled'] as const;
export type LeaveStatus = (typeof LEAVE_STATUSES)[number];

export const LEAVE_DECISIONS = ['approved', 'rejected'] as const;
export type LeaveDecision = (typeof LEAVE_DECISIONS)[number];

export const JOB_TITLE_MAX = 100;
export const LEAVE_REASON_MAX = 1_000;
/** Longest single request, in working days. */
export const LEAVE_MAX_DAYS = 60;
/** Largest annual allowance a leave type can grant. */
export const LEAVE_ALLOWANCE_MAX = 365;
