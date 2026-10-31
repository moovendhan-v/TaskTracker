import { useQueryClient } from '@tanstack/react-query';
import { CalendarClockIcon, ChartBarStackedIcon, ClockIcon, HistoryIcon, ListTreeIcon, TimerIcon, TriangleAlertIcon, UsersRoundIcon } from 'lucide-react';
import { useState } from 'react';
import type { SpaceResponse } from '@taskflow/shared-types';
import { ErrorState } from '@/components/common/error-state';
import { Meter } from '@/components/kit/charts';
import { Block } from '@/components/kit/block';
import { blockStateOf } from '@/components/kit/block-state';
import { usePreferences } from '@/core/preferences/use-preferences';
import { queryKeys } from '@/lib/query-keys';
import { formatNumericDate, type Period } from '@/lib/periods';
import { useCustomFields } from '@/modules/spaces';
import { useOpenTask } from '@/modules/tasks';
import { formatMinutes } from '@/modules/time';
import { useDashboard } from '../hooks/use-dashboard';
import { dashboardInput } from '../lib/dashboard-input';
import { DashboardFilters } from './dashboard-filters';
import { HoursByTask, HoursPerDay, KpiRow, KpiRowSkeleton, StatusBreakdown, Workload } from './dashboard-panels';
import { DashboardTaskList } from './dashboard-task-list';
import { SpaceStatusChip } from './space-status-chip';

/** One project at a glance: health, attributes, counts, hours, phases, people and the lists that need attention. */
export function ProjectDashboard({ workspaceId, space }: { workspaceId: string; space: SpaceResponse }) {
  const { weekStart } = usePreferences();
  const queryClient = useQueryClient();
  const openTask = useOpenTask();
  const [period, setPeriod] = useState<Period>('this_month');
  const [weekAhead] = useState(() => Date.now() + 7 * 86_400_000);
  const dashboard = useDashboard(workspaceId, dashboardInput(period, weekStart, { spaceId: space.id }));
  const data = dashboard.data;
  const state = blockStateOf(dashboard, { what: 'this project' });
  const { data: fields = [] } = useCustomFields(workspaceId, 'space');
  const attributes = fields
    .filter((field) => !field.spaceId || field.spaceId === space.id)
    .map((field) => {
      const value = space.customFields[field.id];
      const labels = (Array.isArray(value) ? value : [value]).map((item) => field.options.find((option) => option.id === item)?.label ?? item);
      return { id: field.id, name: field.name, required: field.required, value: value === null || value === undefined ? '–' : labels.join(', ') };
    });

  return (
    <div className="grid gap-4">
      <DashboardFilters
        period={period}
        onPeriod={setPeriod}
        weekStart={weekStart}
        note="hours are for this period, task counts are all-time"
        refreshing={dashboard.isFetching}
        onRefresh={() => void queryClient.invalidateQueries({ queryKey: queryKeys.dashboardRoot(workspaceId) })}
      />
      {dashboard.isError ? <ErrorState error={dashboard.error} onRetry={() => void dashboard.refetch()} /> : null}
      {!dashboard.isError ? (
        <>
          <section className="grid gap-6 rounded-xl border bg-card p-5 lg:grid-cols-2">
            <div className="grid content-start gap-2">
              <h2 className="flex items-center gap-2 text-sm font-semibold">
                Project status <SpaceStatusChip status={space.status} />
              </h2>
              <p className="text-sm whitespace-pre-wrap text-muted-foreground">{space.statusNote || 'No explanation yet.'}</p>
              {space.startDate || space.dueDate ? (
                <p className="text-sm">
                  {space.startDate ? formatNumericDate(space.startDate) : '–'} → {space.dueDate ? formatNumericDate(space.dueDate) : '–'}
                </p>
              ) : null}
            </div>
            <div className="grid content-start gap-2 lg:border-l lg:pl-6">
              <h2 className="text-sm font-semibold">Project attributes</h2>
              {attributes.length === 0 ? <p className="text-sm text-muted-foreground">No attributes yet. Add project fields in the space settings.</p> : null}
              <dl className="grid grid-cols-[11rem_minmax(0,1fr)] gap-x-4 gap-y-2 text-sm">
                {attributes.map((attribute) => (
                  <div key={attribute.id} className="contents">
                    <dt className="truncate text-muted-foreground">
                      {attribute.name}
                      {attribute.required ? <span className="text-critical"> *</span> : null}
                    </dt>
                    <dd className="truncate">{String(attribute.value)}</dd>
                  </div>
                ))}
              </dl>
            </div>
          </section>
          {data ? <KpiRow data={data} mode="project" /> : <KpiRowSkeleton tiles={6} />}
          <Block title="Status breakdown" icon={ChartBarStackedIcon} state={state} maximisable>
            {data ? <StatusBreakdown data={data} openOnly={false} /> : null}
          </Block>
          <div className="grid gap-4 lg:grid-cols-2">
            <Block title="Hours per day" icon={ClockIcon} state={state} skeleton="chart" maximisable>
              {data ? <HoursPerDay data={data} height={200} /> : null}
            </Block>
            <Block title="Where the time went" icon={TimerIcon} aside="top tasks" state={state} maxBodyHeight={320} maximisable>
              {data ? <HoursByTask data={data} /> : null}
            </Block>
          </div>
          <Block title="Phases" icon={ListTreeIcon} aside="parent tasks and their subtasks" state={state} maximisable>
            {data?.phases.length === 0 ? <p className="py-4 text-center text-sm text-muted-foreground">No tasks with subtasks yet.</p> : null}
            <ul className="divide-y">
              {data?.phases.map((phase) => (
                <li key={phase.id}>
                  <button type="button" onClick={() => openTask(phase.id)} className="grid w-full grid-cols-[minmax(0,1fr)_8rem_5rem_6rem_6rem] items-center gap-4 py-3 text-left hover:bg-muted/40">
                    <span className="min-w-0">
                      <span className="block truncate font-medium">{phase.title}</span>
                      <span className="block truncate text-xs text-muted-foreground">
                        #{phase.number}
                        {phase.assigneeName ? ` · ${phase.assigneeName}` : ''}
                        {phase.dueDate ? ` · due ${formatNumericDate(phase.dueDate)}` : ''}
                      </span>
                    </span>
                    <Meter value={phase.total ? (phase.done / phase.total) * 100 : 0} label={`${phase.title} progress`} />
                    <span className="text-sm tabular-nums text-muted-foreground">
                      {phase.done}/{phase.total} done
                    </span>
                    <span className="text-right text-sm tabular-nums">{phase.minutes ? formatMinutes(phase.minutes) : '–'}</span>
                    <span className="text-right text-sm text-muted-foreground">{phase.status.name}</span>
                  </button>
                </li>
              ))}
            </ul>
          </Block>
          <div className="grid gap-4 lg:grid-cols-3">
            <Block title="People" icon={UsersRoundIcon} state={state} maximisable>
              {data ? <Workload data={data} /> : null}
            </Block>
            <Block title="Overdue" icon={TriangleAlertIcon} chip={data ? { label: String(data.summary.overdue) } : undefined} state={state} maxBodyHeight={420} maximisable>
              {data ? <DashboardTaskList tasks={data.overdueTasks} variant="number" empty="Nothing overdue." /> : null}
            </Block>
            <Block title="Due in the next 7 days" icon={CalendarClockIcon} chip={data ? { label: String(data.summary.dueSoon) } : undefined} state={state} maxBodyHeight={420} maximisable>
              {data ? <DashboardTaskList tasks={data.dueSoonTasks.filter((task) => task.dueDate && new Date(task.dueDate).getTime() < weekAhead)} variant="number" empty="Nothing due this week." /> : null}
            </Block>
          </div>
          <Block title="Recently updated" icon={HistoryIcon} state={state} maximisable>
            {data ? <DashboardTaskList tasks={data.recentlyUpdated} variant="number" date="updated" /> : null}
          </Block>
        </>
      ) : null}
    </div>
  );
}
