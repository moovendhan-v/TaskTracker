import { useQueryClient } from '@tanstack/react-query';
import {
  CalendarClockIcon,
  CalendarRangeIcon,
  ChartBarStackedIcon,
  ClockIcon,
  FlagIcon,
  FolderKanbanIcon,
  HistoryIcon,
  HourglassIcon,
  LayoutGridIcon,
  ListTodoIcon,
  PlusIcon,
  TrendingUpIcon,
  TriangleAlertIcon,
  UsersIcon,
  UsersRoundIcon,
} from 'lucide-react';
import { useState } from 'react';
import { UserAvatar } from '@/components/common/user-avatar';
import { EmptyState } from '@/components/common/empty-state';
import { ErrorState } from '@/components/common/error-state';
import { Block } from '@/components/kit/block';
import { blockStateOf } from '@/components/kit/block-state';
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
  KpiRowSkeleton,
  OverdueAging,
  PriorityPanel,
  StatusBreakdown,
  Workload,
} from '../components/dashboard-panels';
import { DashboardTaskList } from '../components/dashboard-task-list';
import { ProjectsTable } from '../components/projects-table';
import { useDashboard } from '../hooks/use-dashboard';
import { dashboardInput } from '../lib/dashboard-input';

/** A count chip for a block header, once the number is known. */
const count = (value: number | undefined) => (value === undefined ? undefined : { label: String(value) });

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
  // One query feeds every block: they load together, and a failure shows once above them.
  const state = blockStateOf(dashboard, { what: 'the dashboard' });

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
        {dashboard.isError ? <ErrorState error={dashboard.error} onRetry={() => void dashboard.refetch()} /> : null}
        {data && data.projects.length === 0 ? (
          <EmptyState title="Create your first space" description="Spaces hold your projects' lists and tasks. Use the + next to Spaces in the sidebar to add one." />
        ) : null}
        {!dashboard.isError && !(data && data.projects.length === 0) ? (
          <>
            {data ? <KpiRow data={data} mode="home" /> : <KpiRowSkeleton tiles={6} />}
            {data ? <ProjectsTable workspaceId={workspaceId} projects={data.projects} /> : <Block title="Projects" icon={FolderKanbanIcon} state={state} />}
            <div className="grid gap-4 lg:grid-cols-3">
              <Block title="Open work by status" icon={ChartBarStackedIcon} state={state} maximisable>
                {data ? <StatusBreakdown data={data} openOnly /> : null}
              </Block>
              <Block title="Priority" icon={FlagIcon} state={state} maximisable>
                {data ? <PriorityPanel data={data} /> : null}
              </Block>
              <Block title="Overdue aging" icon={HourglassIcon} chip={count(data?.summary.overdue)} state={state} skeleton="chart" maximisable>
                {data ? <OverdueAging data={data} /> : null}
              </Block>
            </div>
            <div className="grid gap-4 lg:grid-cols-2">
              <Block title="Due-date forecast" icon={CalendarRangeIcon} aside="open tasks by due week" state={state} skeleton="chart" maximisable>
                {data ? <DueForecast data={data} /> : null}
              </Block>
              <Block title="Created vs closed" icon={TrendingUpIcon} aside="last 8 weeks" state={state} skeleton="chart" maximisable>
                {data ? <CreatedVsClosed data={data} /> : null}
              </Block>
            </div>
            <div className="grid gap-4 lg:grid-cols-3">
              <Block title="Hours per day" icon={ClockIcon} state={state} skeleton="chart" maximisable>
                {data ? <HoursPerDay data={data} /> : null}
              </Block>
              <Block title="Hours by person" icon={UsersIcon} state={state} maximisable>
                {data ? <HoursByPerson data={data} /> : null}
              </Block>
              <Block title="Hours by project" icon={FolderKanbanIcon} state={state} maximisable>
                {data ? <HoursByProject data={data} /> : null}
              </Block>
            </div>
            <div className="grid gap-4 lg:grid-cols-3">
              <Block title="Overdue" icon={TriangleAlertIcon} chip={count(data?.summary.overdue)} state={state} maxBodyHeight={420} maximisable>
                {data ? <DashboardTaskList tasks={data.overdueTasks} empty="Nothing overdue." /> : null}
              </Block>
              <Block title="Due in the next 14 days" icon={CalendarClockIcon} state={state} maxBodyHeight={420} maximisable>
                {data ? <DashboardTaskList tasks={data.dueSoonTasks} empty="Nothing due soon." /> : null}
              </Block>
              <Block title="Team workload" icon={UsersRoundIcon} state={state} maxBodyHeight={420} maximisable>
                {data ? <Workload data={data} /> : null}
              </Block>
            </div>
            <Block title="Recently updated" icon={HistoryIcon} state={state} maximisable>
              {data ? <DashboardTaskList tasks={data.recentlyUpdated} date="updated" columns={2} /> : null}
            </Block>
          </>
        ) : null}
      </div>
      {creating ? <NewTaskDialog workspaceId={workspaceId} open onOpenChange={setCreating} onCreated={openTask} /> : null}
    </div>
  );
}
