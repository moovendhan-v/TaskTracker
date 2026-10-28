import { Link } from '@tanstack/react-router';
import { CheckCheckIcon, KanbanIcon, TargetIcon } from 'lucide-react';
import type { SprintResponse } from '@taskflow/shared-types';
import { UserAvatar } from '@/components/common/user-avatar';
import { BarList, LineChart, Meter, StackedBar } from '@/components/kit/charts';
import { Button } from '@/components/ui/button';
import { useMemberName } from '@/modules/members';
import { useSprintTasks } from '../hooks/use-sprints';
import { formatSprintRange } from '../lib/sprint-dates';
import { burndown, formatMinutes, localToday, sprintTiming, summarize, workload } from '../lib/sprint-metrics';
import { CompleteSprintDialog } from './complete-sprint-dialog';

const dayLabel = new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric', timeZone: 'UTC' });

interface ActiveSprintPanelProps {
  workspaceId: string;
  sprint: SprintResponse;
  plannedSprints: SprintResponse[];
  canManage: boolean;
  onComplete: (moveOpenTasksToSprintId: string | null) => Promise<unknown>;
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
  // Ahead when the share of work done keeps up with the share of time gone.
  const pace = summary.total === 0 ? null : summary.donePercent >= timing.elapsedPercent ? 'on pace' : 'behind';

  const statusSegments = [...new Map(items.map((task) => [task.status.id, task.status])).values()]
    .sort((a, b) => a.position - b.position)
    .map((status) => ({ key: status.id, label: status.name, color: status.color, value: items.filter((task) => task.status.id === status.id).length }));

  return (
    <section aria-label={`Active sprint: ${sprint.name}`} className="overflow-hidden rounded-2xl border bg-card">
      <div className="flex flex-wrap items-start gap-4 border-b bg-gradient-to-r from-primary/10 via-transparent to-transparent px-5 py-4">
        <div className="min-w-0 flex-1">
          <p className="text-xs font-semibold tracking-wide text-primary uppercase">Active sprint</p>
          <h2 className="truncate text-xl font-semibold">{sprint.name}</h2>
          <p className="text-sm text-muted-foreground">
            {formatSprintRange(sprint.startDate, sprint.endDate)} · {timing.daysLeft === 0 ? 'ends today or has ended' : `${timing.daysLeft} ${timing.daysLeft === 1 ? 'day' : 'days'} left`}
          </p>
          {sprint.goal ? (
            <p className="mt-2 flex items-start gap-1.5 text-sm">
              <TargetIcon className="mt-0.5 size-4 shrink-0 text-primary" /> {sprint.goal}
            </p>
          ) : null}
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" asChild>
            <Link to="/w/$workspaceId/sprints/$sprintId" params={{ workspaceId, sprintId: sprint.id }}>
              <KanbanIcon /> Open board
            </Link>
          </Button>
          {canManage ? (
            <CompleteSprintDialog
              trigger={
                <Button size="sm">
                  <CheckCheckIcon /> Complete sprint
                </Button>
              }
              sprint={sprint}
              plannedSprints={plannedSprints}
              onComplete={onComplete}
            />
          ) : null}
        </div>
      </div>

      <div className="grid gap-px bg-border sm:grid-cols-2 xl:grid-cols-4">
        <Metric label="Work done" value={`${summary.donePercent}%`} hint={`${summary.done} of ${summary.total} tasks${pace ? ` · ${pace}` : ''}`}>
          <Meter value={summary.donePercent} label="Work done" color={pace === 'behind' ? 'var(--warning)' : 'var(--good)'} />
        </Metric>
        <Metric label="Time gone" value={`${timing.elapsedPercent}%`} hint={`Day ${timing.elapsedDays} of ${timing.totalDays}`}>
          <Meter value={timing.elapsedPercent} label="Time gone" color="var(--chart-1)" />
        </Metric>
        <Metric label="Still open" value={String(summary.total - summary.done)} hint={`${summary.inProgress} in progress · ${summary.blocked} blocked`} />
        <Metric label="Estimated" value={formatMinutes(summary.estimateMinutes)} hint={`${formatMinutes(summary.doneEstimateMinutes)} of it done`} />
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
            <h3 className="text-sm font-semibold">By status</h3>
            {statusSegments.length ? <StackedBar segments={statusSegments} label="Sprint tasks by status" /> : <p className="text-sm text-muted-foreground">No tasks yet.</p>}
          </div>
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
