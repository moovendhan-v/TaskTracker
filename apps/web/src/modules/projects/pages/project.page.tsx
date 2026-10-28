import { useQueryClient } from '@tanstack/react-query';
import { Link } from '@tanstack/react-router';
import { DownloadIcon, LayersIcon, PlusIcon, RefreshCwIcon, SearchIcon, XIcon } from 'lucide-react';
import { useDeferredValue, useState } from 'react';
import type { FilterCondition, FilterNode } from '@taskflow/shared-types';
import { EntityIcon } from '@/components/common/entity-icon';
import { ErrorState } from '@/components/common/error-state';
import { FullPageSpinner } from '@/components/common/full-page-spinner';
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/cn';
import { queryKeys } from '@/lib/query-keys';
import { AutomationsPanel } from '@/modules/automations';
import { ProjectDashboard } from '@/modules/dashboard';
import { useLists } from '@/modules/lists';
import { MembersPage, useMemberName } from '@/modules/members';
import { FilterBuilder, fromFilter, toFilter, useResourceSchema, type DraftCondition } from '@/modules/resources';
import { SpaceSettings, useSpaces } from '@/modules/spaces';
import { SprintsPage } from '@/modules/sprints';
import {
  CalendarView,
  exportTasks,
  GROUP_BY,
  ListView,
  NewTaskDialog,
  PlannerView,
  TaskBoardView,
  TimelineView,
  useOpenTask,
  useStatuses,
  useTaskSearch,
  type GroupBy,
} from '@/modules/tasks';
import { TimeReport } from '@/modules/time';
import { usePermissions } from '@/modules/workspaces';
import { ProjectTabs } from '../components/project-tabs';
import { SavedViewsMenu } from '../components/saved-views-menu';
import { TaskTableView } from '../components/task-table-view';
import { TASK_VIEWS, type ProjectView } from '../lib/views';
import { useProjectView } from '../store/project-view.store';

const GROUP_LABELS: Record<GroupBy, string> = { status: 'Status', assignee: 'Assignee', priority: 'Priority', none: 'None' };

interface ProjectPageProps {
  workspaceId: string;
  spaceId: string;
  view: ProjectView;
  /** Narrows the task views to one list of the project. */
  listId?: string;
}

const toggle = (active: boolean) => cn('h-8 rounded-md px-2.5 text-sm font-medium transition-colors', active ? 'bg-primary/15 text-foreground ring-1 ring-primary/50' : 'text-muted-foreground hover:bg-muted hover:text-foreground');

/** A project (space): its tasks in ten views, plus settings, with one shared toolbar for the task views. */
export function ProjectPage({ workspaceId, spaceId, view, listId }: ProjectPageProps) {
  const queryClient = useQueryClient();
  const openTask = useOpenTask();
  const { canIn } = usePermissions(workspaceId);
  const { data: spaces = [], isLoading: spacesLoading } = useSpaces(workspaceId);
  const { data: lists = [] } = useLists(workspaceId);
  const { data: statuses = [] } = useStatuses(workspaceId, spaceId);
  const { data: schema } = useResourceSchema(workspaceId, 'tasks');
  const memberName = useMemberName(workspaceId);
  const [settings, setSettings] = useProjectView(spaceId);
  const [search, setSearch] = useState('');
  const [conditions, setConditions] = useState<DraftCondition[]>([]);
  const [logic, setLogic] = useState<'and' | 'or'>('and');
  const [savedFilter, setSavedFilter] = useState<FilterNode | null>(null);
  const [creating, setCreating] = useState(false);
  const deferredSearch = useDeferredValue(search.trim());

  const space = spaces.find((item) => item.id === spaceId);
  const projectLists = lists.filter((item) => item.spaceId === spaceId);
  const list = projectLists.find((item) => item.id === listId);
  const isTaskView = TASK_VIEWS.includes(view);

  const base: FilterCondition[] = [
    ...(settings.showClosed ? [] : [{ field: 'statusCategory', op: 'nin' as const, values: ['done', 'cancelled'] }]),
    ...(settings.subtasks ? [] : [{ field: 'parentId', op: 'is_null' as const }]),
    ...(settings.mine ? [{ field: 'assigneeId', op: 'eq' as const, value: '@me' }] : []),
  ];
  const userFilter = savedFilter ?? toFilter(conditions, logic);
  const parts: FilterNode[] = [...base, ...(userFilter ? [userFilter] : [])];
  const filter: FilterNode | null = parts.length === 0 ? null : parts.length === 1 ? (parts[0] as FilterNode) : { and: parts };
  const tasks = useTaskSearch(workspaceId, { spaceId, listId: listId ?? null }, { search: deferredSearch || null, filter }, isTaskView && view !== 'table');
  const items = tasks.data?.items ?? [];
  const defaultListId = listId ?? projectLists[0]?.id;

  if (spacesLoading) return <FullPageSpinner />;
  if (!space) return <ErrorState error={new Error('This project no longer exists, or you no longer have access to it.')} />;

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {/* Compact Top Header Bar: Space, Tabs, Search, Refresh, + Task */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b px-6 py-2 bg-card/40">
        <div className="flex items-center gap-3 min-w-0">
          <div className="flex items-center gap-2 shrink-0">
            <EntityIcon variant="badge" icon={space.icon} color={space.color} fallback={{ letter: space.name }} className="size-5" />
            <span className="truncate max-w-[160px] font-semibold text-sm">{space.name}</span>
            {list ? (
              <span className="inline-flex items-center gap-1 rounded-full border bg-muted/40 px-2 py-0.5 text-xs text-muted-foreground">
                {list.name}
                <Link to="/w/$workspaceId/p/$spaceId/$view" params={{ workspaceId, spaceId, view }} search={{}} aria-label="Show all lists" className="rounded-full hover:text-foreground">
                  <XIcon className="size-3" />
                </Link>
              </span>
            ) : null}
          </div>
          <div className="h-4 w-px bg-border/60 shrink-0 hidden sm:block" />
          <ProjectTabs workspaceId={workspaceId} spaceId={spaceId} current={view} listId={listId} />
        </div>

        <div className="flex items-center gap-2 shrink-0 ml-auto">
          <div className="relative">
            <SearchIcon className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-muted-foreground" />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search tasks…"
              aria-label="Search tasks"
              maxLength={100}
              className="h-7 w-36 sm:w-48 rounded-md border bg-muted/30 pr-2 pl-8 text-xs outline-none focus-visible:ring-1 focus-visible:ring-ring transition-all"
            />
          </div>
          <Button variant="ghost" size="icon-sm" className="size-7" aria-label="Refresh tasks" onClick={() => void queryClient.invalidateQueries({ queryKey: queryKeys.tasksRoot(workspaceId) })}>
            <RefreshCwIcon className={cn('size-3.5', tasks.isFetching && 'animate-spin')} />
          </Button>
          {canIn(spaceId, 'task.create') ? (
            <Button size="sm" className="h-7 px-2.5 text-xs gap-1" onClick={() => setCreating(true)}>
              <PlusIcon className="size-3.5" /> Task
            </Button>
          ) : null}
        </div>
      </div>

      {/* Filter and Grouping Toolbar (Only for task views) */}
      {isTaskView ? (
        <div className="flex items-center justify-between border-b px-6 py-1.5 bg-muted/10 text-xs gap-2">
          <div className="flex items-center gap-1.5 flex-wrap">
            {view === 'list' ? (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm" className="h-7 px-2 text-xs">
                    <LayersIcon className="size-3.5 mr-1 text-muted-foreground" /> Group: {GROUP_LABELS[settings.groupBy]}
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start">
                  <DropdownMenuLabel>Group by</DropdownMenuLabel>
                  {GROUP_BY.map((groupBy) => (
                    <DropdownMenuItem key={groupBy} onSelect={() => setSettings({ groupBy })}>
                      {GROUP_LABELS[groupBy]}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            ) : null}
            {schema && view !== 'table' ? (
              <FilterBuilder
                schema={schema}
                conditions={conditions}
                logic={logic}
                exclude={['statusCategory', 'parentId']}
                onChange={(next, nextLogic) => {
                  setSavedFilter(null);
                  setConditions(next);
                  setLogic(nextLogic);
                }}
              />
            ) : null}
            <SavedViewsMenu
              scope={spaceId}
              filter={userFilter}
              onApply={(saved) => {
                const editable = fromFilter(saved.filter, new Set(schema?.fields.filter((field) => field.keyed).map((field) => field.name)));
                if (editable) {
                  setSavedFilter(null);
                  setConditions(editable.conditions);
                  setLogic(editable.logic);
                } else {
                  setSavedFilter(saved.filter ?? null);
                }
              }}
            />
            <div className="h-3.5 w-px bg-border/60 mx-1 hidden sm:block" />
            <button type="button" aria-pressed={settings.mine} className={toggle(settings.mine)} onClick={() => setSettings({ mine: !settings.mine })}>
              Me
            </button>
            <button type="button" aria-pressed={settings.showClosed} className={toggle(settings.showClosed)} onClick={() => setSettings({ showClosed: !settings.showClosed })}>
              Show closed
            </button>
            <button type="button" aria-pressed={settings.subtasks} className={toggle(settings.subtasks)} onClick={() => setSettings({ subtasks: !settings.subtasks })}>
              Subtasks
            </button>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {tasks.data ? (
              <span className="text-[11px] text-muted-foreground tabular-nums hidden sm:inline">
                {tasks.data.total} {settings.showClosed ? 'tasks' : 'open'}
              </span>
            ) : null}
            <Button variant="ghost" size="sm" className="h-7 px-2 text-xs text-muted-foreground hover:text-foreground" onClick={() => exportTasks(items, memberName, `${space.name}.csv`)} disabled={items.length === 0}>
              <DownloadIcon className="size-3.5 mr-1" /> Export
            </Button>
          </div>
        </div>
      ) : null}

      <div className={cn('min-h-0 flex-1 overflow-auto px-6', isTaskView ? 'pb-2' : 'py-5')}>
        {isTaskView && view !== 'table' && tasks.isLoading ? <FullPageSpinner /> : null}
        {tasks.isError ? <ErrorState error={tasks.error} onRetry={() => void tasks.refetch()} /> : null}
        {view === 'list' && tasks.data ? (
          <ListView workspaceId={workspaceId} tasks={items} statuses={statuses} groupBy={settings.groupBy} defaultListId={defaultListId} spaceId={spaceId} scopeKey={`project:${spaceId}`} onOpen={openTask} />
        ) : null}
        {view === 'board' && tasks.data ? <TaskBoardView workspaceId={workspaceId} spaceId={spaceId} statuses={statuses} listId={defaultListId} tasks={items} onOpen={openTask} /> : null}
        {view === 'table' ? <TaskTableView workspaceId={workspaceId} spaceId={spaceId} listId={listId} baseFilter={filter} search={deferredSearch} onOpen={openTask} /> : null}
        {view === 'calendar' && tasks.data ? <CalendarView workspaceId={workspaceId} tasks={items} onOpen={openTask} /> : null}
        {view === 'timeline' && tasks.data ? <TimelineView workspaceId={workspaceId} tasks={items} onOpen={openTask} /> : null}
        {view === 'planner' && tasks.data ? <PlannerView workspaceId={workspaceId} tasks={items} onOpen={openTask} /> : null}
        {view === 'time' ? <TimeReport workspaceId={workspaceId} spaceId={spaceId} onOpenTask={openTask} /> : null}
        {view === 'sprints' ? <SprintsPage workspaceId={workspaceId} spaceId={spaceId} /> : null}
        {view === 'members' ? <MembersPage workspaceId={workspaceId} /> : null}
        {view === 'dashboard' ? <ProjectDashboard workspaceId={workspaceId} space={space} /> : null}
        {view === 'automations' ? <AutomationsPanel workspaceId={workspaceId} spaceId={spaceId} onOpenTask={openTask} /> : null}
        {view === 'settings' ? <SpaceSettings workspaceId={workspaceId} space={space} /> : null}
      </div>

      {isTaskView && view !== 'table' && tasks.data ? (
        <footer className="flex items-center justify-center gap-3 border-t py-2 text-xs text-muted-foreground">
          Loaded {items.length} of {tasks.data.total} {settings.showClosed ? 'tasks' : 'open tasks'}
          {tasks.hasNextPage ? (
            <Button variant="outline" size="sm" onClick={() => void tasks.fetchNextPage()} disabled={tasks.isFetchingNextPage}>
              Load more
            </Button>
          ) : null}
        </footer>
      ) : null}
      {creating ? <NewTaskDialog workspaceId={workspaceId} open onOpenChange={setCreating} spaceId={spaceId} listId={listId} onCreated={openTask} /> : null}
    </div>
  );
}
