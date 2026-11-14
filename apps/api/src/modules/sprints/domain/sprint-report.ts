import type { SprintReportItem, SprintReportOutcome, SprintReportResponse, SprintReportTotals } from '@taskflow/shared-types';
import type { SprintWithCounts } from './sprint.js';

/** One task as a snapshot (or as it is now, for a live report). */
export interface SprintTaskRow {
  taskId: string | null;
  number: number;
  title: string;
  points: number | null;
  statusCategory: string;
  /** End snapshots: where unfinished work went ('backlog' or a sprint id); null when it stayed. */
  destination: string | null;
}

/** Items a report lists at most; the totals always count everything. */
export const SPRINT_REPORT_ITEMS_MAX = 500;

const outcomeOf = (category: string): SprintReportOutcome => (category === 'done' ? 'done' : category === 'cancelled' ? 'cancelled' : 'open');

function totals(rows: readonly { points: number | null }[]): SprintReportTotals {
  return { tasks: rows.length, points: rows.reduce((sum, row) => sum + (row.points ?? 0), 0) };
}

/**
 * Committed vs delivered for one sprint. `start` is the snapshot taken when it
 * started (null for sprints started before snapshots were kept); `end` is the
 * completion snapshot, or the tasks in it now while it's active. Done counts
 * only "done" (cancelled work is shown apart, not as delivered).
 */
export function buildSprintReport(
  sprint: SprintWithCounts,
  start: readonly SprintTaskRow[] | null,
  end: readonly SprintTaskRow[],
  sprintName: (id: string) => string | null,
): SprintReportResponse {
  const startIds = new Set((start ?? []).map((row) => row.taskId).filter((id): id is string => id !== null));
  const endIds = new Set(end.map((row) => row.taskId).filter((id): id is string => id !== null));
  const movedTo = (destination: string | null) => (destination === null ? null : destination === 'backlog' ? 'Backlog' : (sprintName(destination) ?? 'A deleted sprint'));

  const atEnd: SprintReportItem[] = end.map((row) => ({
    taskId: row.taskId,
    number: row.number,
    title: row.title,
    points: row.points,
    outcome: outcomeOf(row.statusCategory),
    added: start !== null && (row.taskId === null || !startIds.has(row.taskId)),
    removed: false,
    movedTo: movedTo(row.destination),
  }));
  const removed: SprintReportItem[] = (start ?? [])
    .filter((row) => row.taskId === null || !endIds.has(row.taskId))
    .map((row) => ({ taskId: row.taskId, number: row.number, title: row.title, points: row.points, outcome: outcomeOf(row.statusCategory), added: false, removed: true, movedTo: null }));

  // Without a start snapshot, a completed sprint still knows what it held at the end.
  const committed = start
    ? totals(start)
    : sprint.status === 'completed' && sprint.committedTasks !== null
      ? { tasks: sprint.committedTasks, points: sprint.committedPoints ?? totals(end).points }
      : totals(end);
  const items = [...atEnd, ...removed].sort((a, b) => a.number - b.number);
  return {
    sprintId: sprint.id,
    name: sprint.name,
    goal: sprint.goal,
    status: sprint.status,
    startDate: sprint.startDate,
    endDate: sprint.endDate,
    startedAt: sprint.startedAt?.toISOString() ?? null,
    completedAt: sprint.completedAt?.toISOString() ?? null,
    hasStartSnapshot: start !== null,
    committed,
    completed: totals(atEnd.filter((item) => item.outcome === 'done')),
    cancelled: totals(atEnd.filter((item) => item.outcome === 'cancelled')),
    notCompleted: totals(atEnd.filter((item) => item.outcome === 'open')),
    added: totals(atEnd.filter((item) => item.added)),
    removed: totals(removed),
    unestimated: end.filter((row) => row.points === null).length,
    items: items.slice(0, SPRINT_REPORT_ITEMS_MAX),
  };
}
