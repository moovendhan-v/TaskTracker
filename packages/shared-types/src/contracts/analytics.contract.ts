import type { StatusCategory, TaskPriority } from '../domain/task.js';
import type { SpaceStatus } from '../domain/custom-field.js';

/** Buckets of the due-date forecast. */
export const FORECAST_KINDS = ['overdue', 'week', 'later', 'none'] as const;
export type ForecastKind = (typeof FORECAST_KINDS)[number];

export interface DashboardRequest {
  /** Window for hours; task counts are live. */
  from: string;
  to: string;
  /** IANA zone used to split hours into days and weeks, e.g. "Europe/Berlin". */
  timeZone: string;
  spaceId?: string | null;
  /** Narrows tasks to these assignees and hours to these people. Others' hours need time.view_all. */
  userIds?: string[] | null;
}

export interface DashboardTask {
  id: string;
  number: number;
  title: string;
  spaceId: string;
  spaceName: string;
  assigneeName: string | null;
  status: { name: string; color: string; category: StatusCategory };
  dueDate: string | null;
  updatedAt: string;
}

export interface DashboardResponse {
  /** True when hours only count the caller's own time (no time.view_all). */
  hoursOnlyMine: boolean;
  summary: {
    projects: number;
    openTasks: number;
    closedTasks: number;
    overdue: number;
    dueSoon: number;
    unassigned: number;
    minutesLogged: number;
    entries: number;
    minutesAllTime: number;
  };
  byStatus: { name: string; color: string; category: StatusCategory; count: number }[];
  byPriority: { priority: TaskPriority; open: number; overdue: number }[];
  /** Overdue open tasks by days late: 1–7, 8–30, 31–90, 90+. */
  overdueAging: number[];
  /** Open tasks by due week: overdue, the next eight weeks, later, no date. */
  dueForecast: { label: string; weekStart: string | null; count: number; kind: ForecastKind }[];
  /** Created and closed per week, last eight weeks. */
  createdVsClosed: { weekStart: string; created: number; closed: number }[];
  minutesPerDay: { day: string; minutes: number }[];
  minutesByPerson: { userId: string; name: string; minutes: number }[];
  minutesByProject: { spaceId: string | null; name: string; minutes: number }[];
  minutesByTask: { taskId: string; number: number; title: string; minutes: number }[];
  people: { userId: string | null; name: string; open: number; overdue: number; minutes: number }[];
  projects: {
    spaceId: string;
    name: string;
    status: SpaceStatus;
    open: number;
    closed: number;
    overdue: number;
    dueSoon: number;
    progress: number;
    minutes: number;
    assignees: number;
    updatedAt: string | null;
  }[];
  phases: { id: string; number: number; title: string; assigneeName: string | null; dueDate: string | null; done: number; total: number; minutes: number; status: DashboardTask['status'] }[];
  overdueTasks: DashboardTask[];
  dueSoonTasks: DashboardTask[];
  recentlyUpdated: DashboardTask[];
}
