import { useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import type { SpaceResponse } from '@taskflow/shared-types';
import { ErrorState } from '@/components/common/error-state';
import { FullPageSpinner } from '@/components/common/full-page-spinner';
import { Meter } from '@/components/kit/charts';
import { Panel } from '@/components/kit/panel';
import { usePreferences } from '@/core/preferences/use-preferences';
import { queryKeys } from '@/lib/query-keys';
import { formatNumericDate, type Period } from '@/lib/periods';
import { useCustomFields } from '@/modules/spaces';
import { useOpenTask } from '@/modules/tasks';
import { formatMinutes } from '@/modules/time';
import { useDashboard } from '../hooks/use-dashboard';
import { dashboardInput } from '../lib/dashboard-input';
import { DashboardFilters } from './dashboard-filters';
import { HoursByTask, HoursPerDay, KpiRow, StatusBreakdown, Workload } from './dashboard-panels';
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
      {dashboard.isLoading ? <FullPageSpinner /> : null}
      {dashboard.isError ? <ErrorState error={dashboard.error} onRetry={() => void dashboard.refetch()} /> : null}
      {data ? (
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
          <KpiRow data={data} mode="project" />
          <Panel title="Status breakdown">
            <StatusBreakdown data={data} openOnly={false} />
          </Panel>
          <div className="grid gap-4 lg:grid-cols-2">
            <Panel title="Hours per day">
              <HoursPerDay data={data} height={200} />
            </Panel>
            <Panel title="Where the time went" aside="top tasks" maxBodyHeight={320}>
              <HoursByTask data={data} />
            </Panel>
          </div>
          <Panel title="Phases" aside="parent tasks and their subtasks">
            {data.phases.length === 0 ? <p className="py-4 text-center text-sm text-muted-foreground">No tasks with subtasks yet.</p> : null}
            <ul className="divide-y">
              {data.phases.map((phase) => (
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
          </Panel>
          <div className="grid gap-4 lg:grid-cols-3">
            <Panel title="People">
              <Workload data={data} />
            </Panel>
            <Panel title={`Overdue (${data.summary.overdue})`} maxBodyHeight={420}>
              <DashboardTaskList tasks={data.overdueTasks} variant="number" empty="Nothing overdue." />
            </Panel>
            <Panel title={`Due in the next 7 days (${data.summary.dueSoon})`} maxBodyHeight={420}>
              <DashboardTaskList tasks={data.dueSoonTasks.filter((task) => task.dueDate && new Date(task.dueDate).getTime() < weekAhead)} variant="number" empty="Nothing due this week." />
            </Panel>
          </div>
          <Panel title="Recently updated">
            <DashboardTaskList tasks={data.recentlyUpdated} variant="number" date="updated" />
          </Panel>
        </>
      ) : null}
    </div>
  );
}
