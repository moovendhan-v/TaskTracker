import { Link } from '@tanstack/react-router';
import { CheckCheckIcon, FileBarChartIcon, KanbanIcon, TargetIcon } from 'lucide-react';
import type { CompleteSprintRequest, SprintResponse } from '@taskflow/shared-types';
import { cn } from '@/lib/cn';
import { UserAvatar } from '@/components/common/user-avatar';
import { BarList, LineChart, Meter } from '@/components/kit/charts';
import { Button } from '@/components/ui/button';
import { useMemberName } from '@/modules/members';
import { useSprintTasks } from '../hooks/use-sprints';
import { formatSprintRange } from '../lib/sprint-dates';
import { burndown, forecast, formatMinutes, localToday, sprintTiming, summarize, workload, type SprintHealth } from '../lib/sprint-metrics';
import { CompleteSprintDialog } from './complete-sprint-dialog';
import { SprintReportDialog } from './sprint-report-dialog';

const HEALTH: Record<SprintHealth, { label: string; className: string }> = {
  healthy: { label: 'Healthy', className: 'bg-good/15 text-good' },
  'at-risk': { label: 'At risk', className: 'bg-warning/15 text-warning' },
  'off-track': { label: 'Off track', className: 'bg-critical/15 text-critical' },
};

const dayLabel = new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric', timeZone: 'UTC' });

interface ActiveSprintPanelProps {
  workspaceId: string;
  sprint: SprintResponse;
  plannedSprints: SprintResponse[];
  canManage: boolean;
  onComplete: (request: CompleteSprintRequest) => Promise<unknown>;
}

/** The running sprint at a glance: how far through it is, how much is done, where the work sits, and who has it. */
export function ActiveSprintPanel({ workspaceId, sprint, plannedSprints, canManage, onComplete }: ActiveSprintPanelProps) {
  const tasks = useSprintTasks(workspaceId, sprint.id);
  const nameOf = useMemberName(workspaceId);
  const items = tasks.data ?? [];
  const today = localToday();
  const timing = sprintTiming(sprint, today);
  const summary = summarize(items);
  const points = burndown(sprint, items, today);
  const prediction = forecast(summary, timing);
  // Ahead when the share of work done keeps up with the share of time gone.
  const pace = summary.total === 0 ? null : summary.donePercent >= timing.elapsedPercent ? 'on pace' : 'behind';

  const statusSegments = [...new Map(items.map((task) => [task.status.id, task.status])).values()]
    .sort((a, b) => a.position - b.position)
    .map((status) => ({ key: status.id, label: status.name, color: status.color, value: items.filter((task) => task.status.id === status.id).length }));

  return (
    <section aria-label={`Active sprint: ${sprint.name}`} className="overflow-hidden rounded-2xl border bg-card">
      {/* Health strip (v2 Features #15a): where the sprint stands in one glance. */}
      <div className="grid gap-3 border-b px-5 py-4">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
          <h2 className="truncate text-base font-semibold tracking-tight">{sprint.name}</h2>
          <span className="rounded-full bg-primary-soft px-2 py-0.5 text-[11px] font-medium text-ring">Active</span>
          <span className="font-mono text-[11.5px] text-muted-foreground">{formatSprintRange(sprint.startDate, sprint.endDate)}</span>
          <span className="font-mono text-[11.5px] text-muted-foreground">
            day {timing.elapsedDays} / {timing.totalDays}
          </span>
          <div className="flex-1" />
          {prediction ? (
            <span className={cn('flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium', HEALTH[prediction.health].className)}>
              <span aria-hidden className="size-1.5 rounded-full bg-current" />
              {HEALTH[prediction.health].label} · forecast {prediction.projectedDone}/{prediction.total}
            </span>
          ) : null}
          <Button variant="outline" size="sm" asChild>
            <Link to="/w/$workspaceId/sprints/$sprintId" params={{ workspaceId, sprintId: sprint.id }}>
              <KanbanIcon /> Open board
            </Link>
          </Button>
          <SprintReportDialog
            workspaceId={workspaceId}
            sprintId={sprint.id}
            trigger={
              <Button variant="outline" size="sm">
                <FileBarChartIcon /> Report
              </Button>
            }
          />
          {canManage ? (
            <CompleteSprintDialog
              trigger={
                <Button size="sm">
                  <CheckCheckIcon /> Complete sprint…
                </Button>
              }
              workspaceId={workspaceId}
              sprint={sprint}
              plannedSprints={plannedSprints}
              onComplete={onComplete}
            />
          ) : null}
        </div>
        {sprint.goal ? (
          <p className="flex items-start gap-1.5 text-sm text-muted-foreground">
            <TargetIcon className="mt-0.5 size-4 shrink-0 text-ring" /> {sprint.goal}
          </p>
        ) : null}
        {statusSegments.length ? (
          <div className="grid gap-2">
            <div className="flex h-2 overflow-hidden rounded-full bg-muted" role="img" aria-label={statusSegments.map((segment) => `${segment.value} ${segment.label}`).join(', ')}>
              {statusSegments.map((segment) => (
                <span key={segment.key} style={{ flex: segment.value, backgroundColor: segment.color }} />
              ))}
            </div>
            <p className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
              {statusSegments.map((segment) => (
                <span key={segment.key} className="flex items-center gap-1.5">
                  <span aria-hidden className="size-1.5 rounded-full" style={{ backgroundColor: segment.color }} />
                  <span className="font-mono text-foreground">{segment.value}</span> {segment.label.toLowerCase()}
                </span>
              ))}
            </p>
          </div>
        ) : null}
      </div>

      <div className="grid gap-px bg-border sm:grid-cols-2 xl:grid-cols-4">
        <Metric label="Work done" value={`${summary.donePercent}%`} hint={`${summary.done} of ${summary.total} tasks${pace ? ` · ${pace}` : ''}`}>
          <Meter value={summary.donePercent} label="Work done" color={pace === 'behind' ? 'var(--warning)' : 'var(--good)'} />
        </Metric>
        <Metric label="Time gone" value={`${timing.elapsedPercent}%`} hint={`Day ${timing.elapsedDays} of ${timing.totalDays}`}>
          <Meter value={timing.elapsedPercent} label="Time gone" color="var(--chart-1)" />
        </Metric>
        <Metric label="Still open" value={String(summary.total - summary.done)} hint={`${summary.inProgress} in progress · ${summary.blocked} blocked`} />
        {summary.points ? (
          <Metric label="Story points" value={`${summary.donePoints} / ${summary.points}`} hint={`${formatMinutes(summary.estimateMinutes)} estimated`} />
        ) : (
          <Metric label="Estimated" value={formatMinutes(summary.estimateMinutes)} hint={`${formatMinutes(summary.doneEstimateMinutes)} of it done`} />
        )}
      </div>

      <div className="grid gap-6 p-5 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
        <div className="grid content-start gap-2">
          <h3 className="text-sm font-semibold">Burndown</h3>
          {summary.total === 0 ? (
            <p className="py-10 text-center text-sm text-muted-foreground">Plan tasks into this sprint to see it burn down.</p>
          ) : (
            <LineChart
              label="Open tasks per day against the ideal pace"
              labels={points.map((point) => dayLabel.format(new Date(`${point.date}T00:00:00Z`)))}
              series={[
                { key: 'remaining', label: 'Open tasks', color: 'var(--chart-1)', values: points.map((point) => point.remaining) },
                { key: 'ideal', label: 'Ideal', color: 'var(--muted-foreground)', values: points.map((point) => point.ideal), reference: true },
              ]}
              formatValue={(value) => String(Math.round(value))}
            />
          )}
        </div>
        <div className="grid content-start gap-5">
          <div className="grid gap-2">
            <h3 className="text-sm font-semibold">Open work by person</h3>
            <BarList
              label="Open sprint tasks per person"
              empty="Everything is done."
              rows={workload(items).map((row) => {
                const name = nameOf(row.assigneeId) ?? 'Unassigned';
                return {
                  key: row.assigneeId ?? 'none',
                  label: (
                    <span className="flex items-center gap-2">
                      {row.assigneeId ? <UserAvatar name={name} className="size-5 text-[9px]" /> : <span className="size-5 rounded-full border border-dashed" />}
                      <span className="truncate">{name}</span>
                    </span>
                  ),
                  value: row.open,
                  display: `${row.open} · ${formatMinutes(row.estimateMinutes)}`,
                };
              })}
            />
          </div>
        </div>
      </div>
    </section>
  );
}

function Metric({ label, value, hint, children }: { label: string; value: string; hint: string; children?: React.ReactNode }) {
  return (
    <div className="grid content-start gap-1.5 bg-card px-5 py-4">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className="text-2xl font-semibold tabular-nums">{value}</span>
      {children}
      <span className="text-xs text-muted-foreground">{hint}</span>
    </div>
  );
}
