import { isClosedCategory, type SprintResponse, type TaskResponse } from '@taskflow/shared-types';

/** yyyy-mm-dd → day number since the epoch (calendar days, no time zones). */
function dayNumber(date: string): number {
  return Math.round(Date.parse(`${date}T00:00:00Z`) / 86_400_000);
}

function dateOf(day: number): string {
  return new Date(day * 86_400_000).toISOString().slice(0, 10);
}

/** Today as yyyy-mm-dd in the browser's own calendar. */
export function localToday(now = new Date()): string {
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}

export interface SprintTiming {
  /** Days in the sprint, both ends included. */
  totalDays: number;
  /** Days gone by, 0 before it starts and totalDays after it ends. */
  elapsedDays: number;
  daysLeft: number;
  /** 0–100 */
  elapsedPercent: number;
}

export function sprintTiming(sprint: Pick<SprintResponse, 'startDate' | 'endDate'>, today: string): SprintTiming {
  const start = dayNumber(sprint.startDate);
  const totalDays = Math.max(1, dayNumber(sprint.endDate) - start + 1);
  const elapsedDays = Math.min(totalDays, Math.max(0, dayNumber(today) - start + 1));
  return { totalDays, elapsedDays, daysLeft: totalDays - elapsedDays, elapsedPercent: Math.round((elapsedDays / totalDays) * 100) };
}

export interface BurndownPoint {
  date: string;
  /** Open tasks at the end of the day; null for days still to come. */
  remaining: number | null;
  /** A straight line from everything open on day one to nothing on the last day. */
  ideal: number;
}

/**
 * Open tasks per day of the sprint, from when each task was completed. Tasks
 * are counted from day one even if they joined later, which keeps the chart
 * honest about scope rather than hiding it.
 */
export function burndown(sprint: Pick<SprintResponse, 'startDate' | 'endDate'>, tasks: readonly Pick<TaskResponse, 'completedAt' | 'status'>[], today: string): BurndownPoint[] {
  const start = dayNumber(sprint.startDate);
  const end = Math.max(start, dayNumber(sprint.endDate));
  const now = dayNumber(today);
  const total = tasks.length;
  const span = Math.max(1, end - start);
  // A closed task without a completion time (moved in already done) counts as done from the start.
  const doneOn = tasks.map((task) => (task.completedAt ? dayNumber(localToday(new Date(task.completedAt))) : isClosedCategory(task.status.category) ? start : null));

  const points: BurndownPoint[] = [];
  for (let day = start; day <= end; day += 1) {
    const done = doneOn.filter((value) => value !== null && value <= day).length;
    points.push({ date: dateOf(day), remaining: day <= now ? total - done : null, ideal: Math.round((total * (1 - (day - start) / span)) * 10) / 10 });
  }
  return points;
}

export interface SprintSummary {
  total: number;
  done: number;
  inProgress: number;
  notStarted: number;
  blocked: number;
  /** Estimated minutes on all tasks and on finished ones. */
  estimateMinutes: number;
  doneEstimateMinutes: number;
  /** 0–100 */
  donePercent: number;
}

export function summarize(tasks: readonly Pick<TaskResponse, 'status' | 'estimateMinutes'>[]): SprintSummary {
  const count = (test: (category: string) => boolean) => tasks.filter((task) => test(task.status.category)).length;
  const done = count((category) => isClosedCategory(category as never));
  const estimateMinutes = tasks.reduce((sum, task) => sum + (task.estimateMinutes ?? 0), 0);
  const doneEstimateMinutes = tasks.filter((task) => isClosedCategory(task.status.category)).reduce((sum, task) => sum + (task.estimateMinutes ?? 0), 0);
  return {
    total: tasks.length,
    done,
    inProgress: count((category) => category === 'started' || category === 'review'),
    notStarted: count((category) => category === 'unstarted'),
    blocked: count((category) => category === 'blocked'),
    estimateMinutes,
    doneEstimateMinutes,
    donePercent: tasks.length ? Math.round((done / tasks.length) * 100) : 0,
  };
}

/** Open tasks per assignee (null for unassigned), busiest first. */
export function workload(tasks: readonly Pick<TaskResponse, 'assigneeId' | 'status' | 'estimateMinutes'>[]): { assigneeId: string | null; open: number; estimateMinutes: number }[] {
  const byAssignee = new Map<string | null, { open: number; estimateMinutes: number }>();
  for (const task of tasks) {
    if (isClosedCategory(task.status.category)) continue;
    const entry = byAssignee.get(task.assigneeId) ?? { open: 0, estimateMinutes: 0 };
    entry.open += 1;
    entry.estimateMinutes += task.estimateMinutes ?? 0;
    byAssignee.set(task.assigneeId, entry);
  }
  return [...byAssignee.entries()].map(([assigneeId, entry]) => ({ assigneeId, ...entry })).sort((a, b) => b.open - a.open);
}

/** "6 h 30 m", "45 m", or "–" for no estimate. */
export function formatMinutes(minutes: number): string {
  if (!minutes) return '–';
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return hours ? (rest ? `${hours} h ${rest} m` : `${hours} h`) : `${rest} m`;
}

export type SprintHealth = 'healthy' | 'at-risk' | 'off-track';

export interface SprintForecast {
  /** Tasks expected done by the last day if the current pace holds. */
  projectedDone: number;
  total: number;
  health: SprintHealth;
}

/**
 * A straight-line forecast: tasks done per elapsed day, carried over the days left.
 * Healthy at ≥ 90% of the scope, at risk at ≥ 70%, off track below. No forecast
 * before the first day or for an empty sprint.
 */
export function forecast(summary: Pick<SprintSummary, 'done' | 'total'>, timing: Pick<SprintTiming, 'elapsedDays' | 'daysLeft'>): SprintForecast | null {
  if (summary.total === 0 || timing.elapsedDays === 0) return null;
  const perDay = summary.done / timing.elapsedDays;
  const projectedDone = Math.min(summary.total, Math.round(summary.done + perDay * timing.daysLeft));
  const ratio = projectedDone / summary.total;
  return { projectedDone, total: summary.total, health: ratio >= 0.9 ? 'healthy' : ratio >= 0.7 ? 'at-risk' : 'off-track' };
}

/**
 * Committed (tasks in the sprint when it closed) vs done, oldest first, for the last `limit`
 * completed sprints. Sprints completed before that was recorded fall back to their current count.
 */
export function velocity(completed: readonly Pick<SprintResponse, 'id' | 'name' | 'endDate' | 'totalTasks' | 'doneTasks' | 'committedTasks'>[], limit = 8) {
  const rows = [...completed].sort((a, b) => a.endDate.localeCompare(b.endDate)).slice(-limit);
  const average = rows.length ? Math.round(rows.reduce((sum, row) => sum + row.doneTasks, 0) / rows.length) : 0;
  return { rows: rows.map((row) => ({ key: row.id, label: row.name, committed: row.committedTasks ?? row.totalTasks, done: row.doneTasks })), average };
}
