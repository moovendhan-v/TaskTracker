import type { SprintReportResponse, SprintReportTotals } from '@taskflow/shared-types';

/** Points when the sprint used them, otherwise tasks: "13 pts", "4 tasks". */
export function reportUnit(report: Pick<SprintReportResponse, 'committed' | 'completed' | 'added' | 'removed' | 'notCompleted'>): 'points' | 'tasks' {
  return [report.committed, report.completed, report.added, report.removed, report.notCompleted].some((totals) => totals.points > 0) ? 'points' : 'tasks';
}

export function formatTotals(totals: SprintReportTotals, unit: 'points' | 'tasks'): string {
  if (unit === 'tasks') return `${totals.tasks} ${totals.tasks === 1 ? 'task' : 'tasks'}`;
  return `${totals.points} ${totals.points === 1 ? 'pt' : 'pts'}`;
}

/** Share of the commitment delivered, 0–100 (more than 100 when added work got done too). */
export function deliveredPercent(report: Pick<SprintReportResponse, 'committed' | 'completed'>, unit: 'points' | 'tasks'): number {
  const committed = unit === 'points' ? report.committed.points : report.committed.tasks;
  const done = unit === 'points' ? report.completed.points : report.completed.tasks;
  return committed ? Math.round((done / committed) * 100) : 0;
}

/** The report as plain text, for pasting into chat or a doc. */
export function reportText(report: SprintReportResponse): string {
  const unit = reportUnit(report);
  const lines = [
    `${report.name} (${report.startDate} – ${report.endDate})${report.status === 'active' ? ', so far' : ''}`,
    ...(report.goal ? [`Goal: ${report.goal}`] : []),
    `Committed: ${formatTotals(report.committed, unit)} · Done: ${formatTotals(report.completed, unit)} (${deliveredPercent(report, unit)}%)`,
    `Added mid-sprint: ${formatTotals(report.added, unit)} · Removed: ${formatTotals(report.removed, unit)} · Not done: ${formatTotals(report.notCompleted, unit)}`,
  ];
  const open = report.items.filter((item) => item.outcome === 'open' && !item.removed);
  if (open.length) lines.push('', 'Not done:', ...open.map((item) => `- #${item.number} ${item.title}${item.movedTo ? ` → ${item.movedTo}` : ''}`));
  return lines.join('\n');
}
