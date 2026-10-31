import { useQueryClient } from '@tanstack/react-query';
import type { DashboardResponse, NamedDashboardResponse } from '@taskflow/shared-types';
import { FolderKanbanIcon, LockIcon, PlusIcon, UsersIcon } from 'lucide-react';
import { useState } from 'react';
import { EmptyState } from '@/components/common/empty-state';
import { ErrorState } from '@/components/common/error-state';
import { UserAvatar } from '@/components/common/user-avatar';
import { Block } from '@/components/kit/block';
import { blockStateOf, type BlockState } from '@/components/kit/block-state';
import { Button } from '@/components/ui/button';
import { useCurrentUser } from '@/core/auth/use-current-user';
import { usePreferences } from '@/core/preferences/use-preferences';
import { queryKeys } from '@/lib/query-keys';
import type { Period } from '@/lib/periods';
import { useMemberName } from '@/modules/members';
import { NewTaskDialog, useOpenTask } from '@/modules/tasks';
import { ArrangeableGrid } from '../components/arrangeable-grid';
import { DashboardFilters } from '../components/dashboard-filters';
import { DashboardTabs, type HomeTab } from '../components/dashboard-tabs';
import { KpiRow, KpiRowSkeleton } from '../components/dashboard-panels';
import { ProjectsTable } from '../components/projects-table';
import { useDashboard } from '../hooks/use-dashboard';
import { useDashboardLayout, useLayout } from '../hooks/use-layout';
import { useNamedDashboardMutations, useNamedDashboards } from '../hooks/use-named-dashboards';
import { dashboardInput } from '../lib/dashboard-input';

function greeting(hour: number): string {
  return hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening';
}

interface GridProps {
  data: DashboardResponse | undefined;
  state: BlockState;
}

/** Overview and My work: your own arrangement of Home. */
function PersonalGrid({ workspaceId, ...props }: GridProps & { workspaceId: string }) {
  return <ArrangeableGrid layout={useLayout(workspaceId, 'home')} canArrange {...props} />;
}

/** A named dashboard: its owner arranges it, everyone else sees it with their own data. */
function NamedGrid({ workspaceId, dashboard, ownerName, ...props }: GridProps & { workspaceId: string; dashboard: NamedDashboardResponse; ownerName: string }) {
  const layout = useDashboardLayout(workspaceId, dashboard.id);
  const note =
    dashboard.visibility === 'private' ? (
      <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <LockIcon className="size-3.5" /> Private: only you can see this dashboard.
      </span>
    ) : (
      <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <UsersIcon className="size-3.5" />
        {dashboard.mine ? 'Shared with the workspace. Only you can change it.' : `Shared by ${ownerName}. Numbers show what you have access to.`}
      </span>
    );
  return <ArrangeableGrid key={dashboard.id} layout={layout} canArrange={dashboard.mine} leading={note} {...props} />;
}

/** Everything across the workspace's projects, plus named dashboards the team can share. */
export function HomePage({ workspaceId }: { workspaceId: string }) {
  const { data: me } = useCurrentUser();
  const { weekStart } = usePreferences();
  const queryClient = useQueryClient();
  const openTask = useOpenTask();
  const memberName = useMemberName(workspaceId);
  const [tab, setTab] = useState<HomeTab>('overview');
  const [period, setPeriod] = useState<Period>('this_week');
  const [people, setPeople] = useState<string[]>([]);
  const [creating, setCreating] = useState(false);
  const named = useNamedDashboards(workspaceId);
  const dashboards = named.data ?? [];
  const mutations = useNamedDashboardMutations(workspaceId);
  const active = dashboards.find((dashboard) => `dashboard:${dashboard.id}` === tab);
  // A dashboard that was deleted or unshared falls back to the overview, but only once the
  // list has loaded: never show (and let someone edit) the overview in a dashboard's place.
  const waiting = tab.startsWith('dashboard:') && !active && named.isFetching;
  const current: HomeTab = tab.startsWith('dashboard:') && !active && !waiting ? 'overview' : tab;

  const userIds = current === 'mine' && me ? [me.id] : people;
  const dashboard = useDashboard(workspaceId, dashboardInput(period, weekStart, { userIds }));
  const data = dashboard.data;
  const firstName = me?.name.split(' ')[0] ?? '';
  // One query feeds every block: they load together, and a failure shows once above them.
  const state = blockStateOf(dashboard, { what: 'the dashboard' });
  const nameOf = (userId: string) => memberName(userId) ?? 'a teammate';

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
        <DashboardTabs
          tab={current}
          onTab={setTab}
          dashboards={dashboards}
          ownerName={nameOf}
          onCreate={(name) => mutations.create.mutateAsync({ name, visibility: 'private' })}
          onRename={(target, name) => mutations.update.mutateAsync({ id: target.id, name })}
          onShare={(target, shared) => mutations.update.mutate({ id: target.id, visibility: shared ? 'workspace' : 'private' })}
          onDuplicate={(target) =>
            void mutations.create
              .mutateAsync({ name: `${target.name} (copy)`.slice(0, 60), visibility: 'private', items: target.items })
              .then((copy) => setTab(`dashboard:${copy.id}`))
          }
          onDelete={(target) => mutations.remove.mutateAsync(target.id).then(() => setTab('overview'))}
        />
        <DashboardFilters
          period={period}
          onPeriod={setPeriod}
          weekStart={weekStart}
          note="hours are for this period, task counts are live"
          refreshing={dashboard.isFetching}
          onRefresh={() => void queryClient.invalidateQueries({ queryKey: queryKeys.dashboardRoot(workspaceId) })}
          people={current === 'mine' ? undefined : { workspaceId, selected: people, onChange: setPeople, meId: me?.id }}
        />
        {dashboard.isError ? <ErrorState error={dashboard.error} onRetry={() => void dashboard.refetch()} /> : null}
        {data && data.projects.length === 0 ? (
          <EmptyState title="Create your first space" description="Spaces hold your projects' lists and tasks. Use the + next to Spaces in the sidebar to add one." />
        ) : null}
        {!dashboard.isError && !(data && data.projects.length === 0) ? (
          <>
            {data ? <KpiRow data={data} mode="home" /> : <KpiRowSkeleton tiles={6} />}
            {data ? <ProjectsTable workspaceId={workspaceId} projects={data.projects} /> : <Block title="Projects" icon={FolderKanbanIcon} state={state} />}
            {waiting ? null : active ? (
              <NamedGrid workspaceId={workspaceId} dashboard={active} ownerName={nameOf(active.ownerId)} data={data} state={state} />
            ) : (
              <PersonalGrid workspaceId={workspaceId} data={data} state={state} />
            )}
          </>
        ) : null}
      </div>
      {creating ? <NewTaskDialog workspaceId={workspaceId} open onOpenChange={setCreating} onCreated={openTask} /> : null}
    </div>
  );
}
