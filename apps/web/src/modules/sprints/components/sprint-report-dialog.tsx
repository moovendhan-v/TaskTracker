import type { SprintReportItem, SprintReportResponse } from '@taskflow/shared-types';
import { ClipboardCopyIcon, InfoIcon } from 'lucide-react';
import { useState, type ReactNode } from 'react';
import { notify } from '@/components/kit/notify';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { cn } from '@/lib/cn';
import { useOpenTask } from '@/modules/tasks';
import { useSprintReport } from '../hooks/use-sprints';
import { formatSprintRange } from '../lib/sprint-dates';
import { deliveredPercent, formatTotals, reportText, reportUnit } from '../lib/sprint-report';

const OUTCOME: Record<SprintReportItem['outcome'], { label: string; className: string }> = {
  done: { label: 'Done', className: 'bg-good/15 text-good' },
  cancelled: { label: 'Cancelled', className: 'bg-muted text-muted-foreground' },
  open: { label: 'Not done', className: 'bg-warning/15 text-warning' },
};

/**
 * The sprint report: what the sprint committed to and what it delivered, with
 * work added or taken out mid-sprint and where unfinished work went. Live while
 * the sprint runs; fixed once it's completed.
 */
export function SprintReportDialog({ workspaceId, sprintId, trigger }: { workspaceId: string; sprintId: string; trigger: ReactNode }) {
  const [open, setOpen] = useState(false);
  const report = useSprintReport(workspaceId, sprintId, open);
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="sm:max-w-3xl">
        {report.data ? (
          <ReportBody report={report.data} onOpenTask={() => setOpen(false)} />
        ) : (
          <DialogHeader>
            <DialogTitle>Sprint report</DialogTitle>
            <DialogDescription>{report.isError ? 'The report couldn’t be loaded.' : 'Loading…'}</DialogDescription>
          </DialogHeader>
        )}
      </DialogContent>
    </Dialog>
  );
}

function Tile({ label, value, hint, tone }: { label: string; value: string; hint?: string; tone?: 'good' | 'warning' }) {
  return (
    <div className="grid gap-0.5 rounded-lg border bg-card px-3 py-2.5">
      <span className="font-mono text-[10.5px] font-semibold tracking-[0.06em] text-subtle-foreground uppercase">{label}</span>
      <span className={cn('text-lg font-semibold tabular-nums', tone === 'good' && 'text-good', tone === 'warning' && 'text-warning')}>{value}</span>
      {hint ? <span className="text-xs text-muted-foreground">{hint}</span> : null}
    </div>
  );
}

function ReportBody({ report, onOpenTask }: { report: SprintReportResponse; onOpenTask: () => void }) {
  const openTask = useOpenTask();
  const unit = reportUnit(report);
  const percent = deliveredPercent(report, unit);
  const other = (totals: { tasks: number; points: number }) => (unit === 'points' ? `${totals.tasks} ${totals.tasks === 1 ? 'task' : 'tasks'}` : undefined);
  const copy = () => void navigator.clipboard?.writeText(reportText(report)).then(() => notify.success('Report copied'));

  return (
    <>
      <DialogHeader>
        <DialogTitle>{report.name} report</DialogTitle>
        <DialogDescription>
          {formatSprintRange(report.startDate, report.endDate)} · {report.status === 'active' ? 'Live: updates as the sprint goes' : 'Completed'}
          {report.goal ? ` · Goal: ${report.goal}` : ''}
        </DialogDescription>
      </DialogHeader>

      <div className="grid gap-2">
        <div className="flex items-baseline justify-between gap-3 text-sm">
          <span>
            <span className="font-semibold">{formatTotals(report.completed, unit)}</span> done of <span className="font-semibold">{formatTotals(report.committed, unit)}</span> committed
          </span>
          <span className="font-mono text-muted-foreground">{percent}%</span>
        </div>
        <div className="h-2 overflow-hidden rounded-full bg-muted" role="meter" aria-label="Commitment delivered" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.min(100, percent)}>
          <div className="h-full rounded-full bg-good" style={{ width: `${Math.min(100, percent)}%` }} />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
        <Tile label="Committed" value={formatTotals(report.committed, unit)} hint={other(report.committed)} />
        <Tile label="Done" value={formatTotals(report.completed, unit)} hint={other(report.completed)} tone="good" />
        <Tile label="Not done" value={formatTotals(report.notCompleted, unit)} hint={other(report.notCompleted)} tone={report.notCompleted.tasks ? 'warning' : undefined} />
        <Tile label="Added" value={formatTotals(report.added, unit)} hint={other(report.added) ?? 'after it started'} />
        <Tile label="Removed" value={formatTotals(report.removed, unit)} hint={other(report.removed) ?? 'taken out'} />
      </div>

      {!report.hasStartSnapshot || (unit === 'points' && report.unestimated) || report.cancelled.tasks ? (
        <ul className="grid gap-1 text-xs text-muted-foreground">
          {!report.hasStartSnapshot ? (
            <li className="flex gap-1.5">
              <InfoIcon className="size-3.5 shrink-0" /> Started before reports were kept, so committed is what it held at the end and nothing shows as added.
            </li>
          ) : null}
          {unit === 'points' && report.unestimated ? (
            <li className="flex gap-1.5">
              <InfoIcon className="size-3.5 shrink-0" /> {report.unestimated} {report.unestimated === 1 ? 'task has' : 'tasks have'} no story points and count as 0.
            </li>
          ) : null}
          {report.cancelled.tasks ? (
            <li className="flex gap-1.5">
              <InfoIcon className="size-3.5 shrink-0" /> {formatTotals(report.cancelled, unit)} cancelled, not counted as done.
            </li>
          ) : null}
        </ul>
      ) : null}

      <div className="overflow-x-auto rounded-lg border">
        <table className="w-full text-sm" aria-label="Tasks in the sprint">
          <thead>
            <tr className="border-b text-left font-mono text-[10.5px] font-semibold tracking-[0.06em] text-subtle-foreground uppercase">
              <th scope="col" className="px-3 py-2">Task</th>
              <th scope="col" className="px-2 py-2 text-right">Points</th>
              <th scope="col" className="px-2 py-2">Outcome</th>
              <th scope="col" className="px-3 py-2">Notes</th>
            </tr>
          </thead>
          <tbody>
            {report.items.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-3 py-6 text-center text-muted-foreground">
                  No tasks in this sprint.
                </td>
              </tr>
            ) : null}
            {report.items.map((item) => (
              <tr key={`${item.taskId ?? 'gone'}-${item.number}-${item.removed}`} className={cn('border-b last:border-b-0', item.removed && 'text-muted-foreground')}>
                <td className="max-w-80 px-3 py-1.5">
                  <span className="mr-2 font-mono text-xs text-muted-foreground">#{item.number}</span>
                  {item.taskId ? (
                    <button
                      type="button"
                      className={cn('truncate text-left hover:text-primary', item.removed && 'line-through')}
                      onClick={() => {
                        onOpenTask();
                        openTask(item.taskId!);
                      }}
                    >
                      {item.title}
                    </button>
                  ) : (
                    <span className="truncate" title="Deleted since">
                      {item.title}
                    </span>
                  )}
                </td>
                <td className="px-2 py-1.5 text-right font-mono tabular-nums">{item.points ?? '–'}</td>
                <td className="px-2 py-1.5">
                  <span className={cn('rounded-full px-2 py-0.5 text-[11px] font-medium', item.removed ? 'bg-muted text-muted-foreground' : OUTCOME[item.outcome].className)}>
                    {item.removed ? 'Removed' : OUTCOME[item.outcome].label}
                  </span>
                </td>
                <td className="px-3 py-1.5 text-xs text-muted-foreground">
                  {[item.added ? 'Added mid-sprint' : null, item.movedTo ? `Moved to ${item.movedTo}` : null].filter(Boolean).join(' · ')}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex justify-end">
        <Button variant="outline" size="sm" onClick={copy}>
          <ClipboardCopyIcon /> Copy as text
        </Button>
      </div>
    </>
  );
}
