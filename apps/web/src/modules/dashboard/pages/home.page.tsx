import { useQueryClient } from '@tanstack/react-query';
import {
  FolderKanbanIcon,
  LayoutDashboardIcon,
  LayoutGridIcon,
  ListTodoIcon,
  PlusIcon,
  RotateCcwIcon,
  Trash2Icon,
  Undo2Icon,
} from 'lucide-react';
import { useEffect, useState } from 'react';
import { DEFAULT_LAYOUTS, type HomeBlockType, type LayoutItem } from '@taskflow/shared-types';
import { UserAvatar } from '@/components/common/user-avatar';
import { ConfirmDialog } from '@/components/common/confirm-dialog';
import { EmptyState } from '@/components/common/empty-state';
import { ErrorState } from '@/components/common/error-state';
import { Block } from '@/components/kit/block';
import { blockStateOf } from '@/components/kit/block-state';
import { Segmented } from '@/components/kit/segmented';
import { Button } from '@/components/ui/button';
import { toast } from '@/components/ui/sonner';
import { useCurrentUser } from '@/core/auth/use-current-user';
import { usePreferences } from '@/core/preferences/use-preferences';
import { queryKeys } from '@/lib/query-keys';
import type { Period } from '@/lib/periods';
import { NewTaskDialog, useOpenTask } from '@/modules/tasks';
import { DashboardFilters } from '../components/dashboard-filters';
import { BlockGrid } from '../components/block-grid';
import { BlockLibrary } from '../components/block-library';
import { KpiRow, KpiRowSkeleton } from '../components/dashboard-panels';
import { HOME_BLOCKS } from '../components/home-blocks';
import { ProjectsTable } from '../components/projects-table';
import { useDashboard } from '../hooks/use-dashboard';
import { useLayout } from '../hooks/use-layout';
import { addItem, removeItem } from '../lib/grid';
import { dashboardInput } from '../lib/dashboard-input';

function isEditable(target: EventTarget | null): boolean {
  return target instanceof HTMLElement && (target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName));
}

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
  const layout = useLayout(workspaceId, 'home');
  const [arranging, setArranging] = useState(false);
  const [library, setLibrary] = useState(false);

  const remove = (item: LayoutItem) => {
    if (!layout.items) return;
    layout.setItems(removeItem(layout.items, item.id));
    toast(`Removed ${HOME_BLOCKS[item.type as HomeBlockType].title}`, { duration: 10_000, action: { label: 'Undo', onClick: () => layout.undo() } });
  };
  const add = (type: HomeBlockType) => {
    if (!layout.items) return;
    layout.setItems(addItem(layout.items, { id: type, type, ...HOME_BLOCKS[type].size }));
    setLibrary(false);
  };

  // E: arrange, A: add a block, ⌘/Ctrl+Z: undo while arranging, Esc: done.
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (isEditable(event.target) || document.querySelector('[role="dialog"]')) return;
      const plain = !event.metaKey && !event.ctrlKey && !event.altKey && !event.shiftKey;
      if (plain && event.key.toLowerCase() === 'e') {
        event.preventDefault();
        setArranging((value) => !value);
      } else if (plain && event.key.toLowerCase() === 'a') {
        event.preventDefault();
        setArranging(true);
        setLibrary(true);
      } else if (arranging && event.key === 'Escape') {
        setArranging(false);
      } else if (arranging && (event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'z' && layout.undo()) {
        event.preventDefault();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [arranging, layout]);

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
          {arranging ? (
            <div className="flex flex-wrap items-center gap-2" role="toolbar" aria-label="Arrange blocks">
              <span className="mr-1 flex items-center gap-1.5 rounded-full bg-primary-soft px-2.5 py-1 text-xs font-medium text-ring">
                <LayoutDashboardIcon className="size-3.5" /> Arranging
              </span>
              <Button variant="outline" size="sm" onClick={() => setLibrary(true)}>
                <PlusIcon /> Add block <kbd className="ml-1 font-mono text-[10.5px] text-subtle-foreground">A</kbd>
              </Button>
              <Button variant="outline" size="sm" disabled={!layout.canUndo} onClick={() => layout.undo()}>
                <Undo2Icon /> Undo
              </Button>
              <ConfirmDialog
                trigger={
                  <Button variant="outline" size="sm" disabled={!layout.isCustom}>
                    <RotateCcwIcon /> Reset
                  </Button>
                }
                title="Reset this page's layout?"
                description="Your arrangement is replaced by the default one. This can't be undone."
                confirmLabel="Reset layout"
                onConfirm={() => layout.reset()}
              />
              <Button size="sm" onClick={() => setArranging(false)}>
                Done <kbd className="ml-1 font-mono text-[10.5px] opacity-70">E</kbd>
              </Button>
            </div>
          ) : (
            <>
              <Button variant="outline" onClick={() => setArranging(true)} disabled={!layout.items}>
                <LayoutDashboardIcon /> Arrange <kbd className="ml-1 font-mono text-[10.5px] text-subtle-foreground">E</kbd>
              </Button>
              <Button onClick={() => setCreating(true)}>
                <PlusIcon /> New task
              </Button>
            </>
          )}
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
            {layout.items ? (
              <BlockGrid
                items={layout.items}
                arranging={arranging}
                onChange={(items) => layout.setItems(items)}
                onRemove={remove}
                titleOf={(item) => HOME_BLOCKS[item.type as HomeBlockType].title}
                renderBlock={(item) => {
                  const block = HOME_BLOCKS[item.type as HomeBlockType];
                  const chip = data && block.chip?.(data);
                  return (
                    <Block
                      title={block.title}
                      icon={block.icon}
                      aside={block.aside}
                      chip={chip ? { label: chip } : undefined}
                      state={state}
                      skeleton={block.skeleton}
                      arranging={arranging}
                      maximisable
                      actions={[{ label: 'Remove', icon: Trash2Icon, destructive: true, onSelect: () => remove(item) }]}
                      bodyClassName="overflow-y-auto"
                    >
                      {data ? block.render(data) : null}
                    </Block>
                  );
                }}
              />
            ) : null}
          </>
        ) : null}
      </div>
      <BlockLibrary open={library} onOpenChange={setLibrary} placed={new Set((layout.items ?? DEFAULT_LAYOUTS.home).map((item) => item.type))} onAdd={add} />
      {creating ? <NewTaskDialog workspaceId={workspaceId} open onOpenChange={setCreating} onCreated={openTask} /> : null}
    </div>
  );
}
