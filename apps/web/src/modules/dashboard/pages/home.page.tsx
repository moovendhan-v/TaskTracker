import { useQueryClient } from '@tanstack/react-query';
import { LayoutGridIcon, ListTodoIcon, PlusIcon } from 'lucide-react';
import { useState } from 'react';
import { UserAvatar } from '@/components/common/user-avatar';
import { FullPageSpinner } from '@/components/common/full-page-spinner';
import { EmptyState } from '@/components/common/empty-state';
import { ErrorState } from '@/components/common/error-state';
import { Panel } from '@/components/kit/panel';
import { Segmented } from '@/components/kit/segmented';
import { Button } from '@/components/ui/button';
import { useCurrentUser } from '@/core/auth/use-current-user';
import { usePreferences } from '@/core/preferences/use-preferences';
import { queryKeys } from '@/lib/query-keys';
import type { Period } from '@/lib/periods';
import { NewTaskDialog, useOpenTask } from '@/modules/tasks';
import { DashboardFilters } from '../components/dashboard-filters';
import {
  CreatedVsClosed,
  DueForecast,
  HoursByPerson,
  HoursByProject,
  HoursPerDay,
  KpiRow,
  OverdueAging,
  PriorityPanel,
  StatusBreakdown,
  Workload,
} from '../components/dashboard-panels';
import { DashboardTaskList } from '../components/dashboard-task-list';
import { ProjectsTable } from '../components/projects-table';
import { useDashboard } from '../hooks/use-dashboard';
import { dashboardInput } from '../lib/dashboard-input';

function greeting(hour: number): string {
  return hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening';
}

/** Everything across the workspace's projects: counts, health, charts and the lists that need attention. */
export function HomePage({ workspaceId }: { workspaceId: string }) {
  const { data: me } = useCurrentUser();
  const { weekStart } = usePreferences();
  const queryClient = useQueryClient();
  const openTask = useOpenTask();
  const [tab, setTab] = useState<'overview' | 'mine'>('overview');
  const [period, setPeriod] = useState<Period>('this_week');
  const [people, setPeople] = useState<string[]>([]);
  const [creating, setCreating] = useState(false);
  const userIds = tab === 'mine' && me ? [me.id] : people;
  const dashboard = useDashboard(workspaceId, dashboardInput(period, weekStart, { userIds }));
  const data = dashboard.data;
  const firstName = me?.name.split(' ')[0] ?? '';

  return (
    <div className="min-h-0 flex-1 overflow-y-auto">
      <div className="mx-auto grid max-w-[96rem] gap-5 px-6 py-6">
        <header className="flex flex-wrap items-center gap-4">
          {me ? <UserAvatar name={me.name} className="size-12 text-base" /> : null}
          <div className="min-w-0 flex-1">
            <h1 className="text-2xl font-bold tracking-tight">
              {greeting(new Date().getHours())}, {firstName}
            </h1>
            <p className="text-sm text-muted-foreground">Everything across your projects</p>
          </div>
          <Button onClick={() => setCreating(true)}>
            <PlusIcon /> New task
          </Button>
        </header>
        <Segmented
          variant="joined"
          size="md"
          label="Home view"
          value={tab}
          onChange={setTab}
          options={[
            { value: 'overview', label: 'Overview', icon: <LayoutGridIcon /> },
            { value: 'mine', label: 'My work', icon: <ListTodoIcon /> },
          ]}
        />
        <DashboardFilters
          period={period}
          onPeriod={setPeriod}
          weekStart={weekStart}
          note="hours are for this period, task counts are live"
          refreshing={dashboard.isFetching}
          onRefresh={() => void queryClient.invalidateQueries({ queryKey: queryKeys.dashboardRoot(workspaceId) })}
          people={tab === 'overview' ? { workspaceId, selected: people, onChange: setPeople, meId: me?.id } : undefined}
        />
        {dashboard.isLoading ? <FullPageSpinner /> : null}
        {dashboard.isError ? <ErrorState error={dashboard.error} onRetry={() => void dashboard.refetch()} /> : null}
        {data && data.projects.length === 0 ? (
          <EmptyState title="Create your first space" description="Spaces hold your projects' lists and tasks. Use the + next to Spaces in the sidebar to add one." />
        ) : null}
        {data && data.projects.length > 0 ? (
          <>
            <KpiRow data={data} mode="home" />
            <ProjectsTable workspaceId={workspaceId} projects={data.projects} />
            <div className="grid gap-4 lg:grid-cols-3">
              <Panel title="Open work by status">
                <StatusBreakdown data={data} openOnly />
              </Panel>
              <Panel title="Priority">
                <PriorityPanel data={data} />
              </Panel>
              <Panel title={`Overdue aging (${data.summary.overdue})`}>
                <OverdueAging data={data} />
              </Panel>
            </div>
            <div className="grid gap-4 lg:grid-cols-2">
              <Panel title="Due-date forecast" aside="open tasks by due week">
                <DueForecast data={data} />
              </Panel>
              <Panel title="Created vs closed" aside="last 8 weeks">
                <CreatedVsClosed data={data} />
              </Panel>
            </div>
            <div className="grid gap-4 lg:grid-cols-3">
              <Panel title="Hours per day">
                <HoursPerDay data={data} />
              </Panel>
              <Panel title="Hours by person">
                <HoursByPerson data={data} />
              </Panel>
              <Panel title="Hours by project">
                <HoursByProject data={data} />
              </Panel>
            </div>
            <div className="grid gap-4 lg:grid-cols-3">
              <Panel title={`Overdue (${data.summary.overdue})`} maxBodyHeight={420}>
                <DashboardTaskList tasks={data.overdueTasks} empty="Nothing overdue." />
              </Panel>
              <Panel title="Due in the next 14 days" maxBodyHeight={420}>
                <DashboardTaskList tasks={data.dueSoonTasks} empty="Nothing due soon." />
              </Panel>
              <Panel title="Team workload" maxBodyHeight={420}>
                <Workload data={data} />
              </Panel>
            </div>
            <Panel title="Recently updated">
              <DashboardTaskList tasks={data.recentlyUpdated} date="updated" columns={2} />
            </Panel>
          </>
        ) : null}
      </div>
      {creating ? <NewTaskDialog workspaceId={workspaceId} open onOpenChange={setCreating} onCreated={openTask} /> : null}
    </div>
  );
}
