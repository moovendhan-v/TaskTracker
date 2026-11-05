import type { DashboardResponse } from '@taskflow/shared-types';

/** Which tasks and hours a dashboard counts. */
export interface DashboardScope {
  workspaceId: string;
  spaceId: string | null;
  /** Assignees whose tasks count; null for everyone. */
  assigneeIds: readonly string[] | null;
  /** People whose hours count; null for everyone. */
  timeUserIds: readonly string[] | null;
  /** Priorities the task lists keep; null for all. */
  priorities: readonly string[] | null;
  /** Status meanings the task lists keep; null for all. */
  categories: readonly string[] | null;
  from: Date;
  to: Date;
  timeZone: string;
}

/** Read-only aggregates over tasks and time. Every query is scoped to one workspace. */
export abstract class AnalyticsRepository {
  abstract taskSummary(scope: DashboardScope): Promise<Omit<DashboardResponse['summary'], 'minutesLogged' | 'entries' | 'minutesAllTime'>>;
  abstract byStatus(scope: DashboardScope): Promise<DashboardResponse['byStatus']>;
  abstract byPriority(scope: DashboardScope): Promise<DashboardResponse['byPriority']>;
  abstract overdueAging(scope: DashboardScope): Promise<number[]>;
  abstract dueForecast(scope: DashboardScope): Promise<DashboardResponse['dueForecast']>;
  abstract createdVsClosed(scope: DashboardScope): Promise<DashboardResponse['createdVsClosed']>;
  abstract timeTotals(scope: DashboardScope): Promise<{ minutes: number; entries: number; allTime: number }>;
  abstract minutesPerDay(scope: DashboardScope): Promise<DashboardResponse['minutesPerDay']>;
  abstract minutesByPerson(scope: DashboardScope): Promise<DashboardResponse['minutesByPerson']>;
  abstract minutesByProject(scope: DashboardScope): Promise<DashboardResponse['minutesByProject']>;
  abstract minutesByTask(scope: DashboardScope, limit: number): Promise<DashboardResponse['minutesByTask']>;
  abstract people(scope: DashboardScope): Promise<DashboardResponse['people']>;
  abstract projects(scope: DashboardScope): Promise<DashboardResponse['projects']>;
  abstract phases(scope: DashboardScope, limit: number): Promise<DashboardResponse['phases']>;
  abstract taskList(scope: DashboardScope, kind: 'overdue' | 'dueSoon' | 'recent', limit: number): Promise<DashboardResponse['overdueTasks']>;
}
