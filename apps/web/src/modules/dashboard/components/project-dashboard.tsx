import { useQueryClient } from '@tanstack/react-query';
import { PROJECT_BLOCK_TYPES, type DashboardResponse, type ProjectBlockType, type SpaceResponse } from '@taskflow/shared-types';
import { CalendarClockIcon, ChartBarStackedIcon, ClockIcon, GaugeIcon, HistoryIcon, InfoIcon, ListTreeIcon, TimerIcon, TriangleAlertIcon, UsersRoundIcon } from 'lucide-react';
import { useMemo, useState } from 'react';
import { ErrorState } from '@/components/common/error-state';
import { Meter } from '@/components/kit/charts';
import { blockStateOf } from '@/components/kit/block-state';
import { usePreferences } from '@/core/preferences/use-preferences';
import { queryKeys } from '@/lib/query-keys';
import { formatNumericDate, type Period } from '@/lib/periods';
import { useCustomFields } from '@/modules/spaces';
import { useOpenTask } from '@/modules/tasks';
import { formatMinutes } from '@/modules/time';
import { useDashboard } from '../hooks/use-dashboard';
import { useLayout } from '../hooks/use-layout';
import { dashboardInput } from '../lib/dashboard-input';
import { ArrangeableGrid } from './arrangeable-grid';
import { DashboardFilters } from './dashboard-filters';
import { HoursByTask, HoursPerDay, KpiRow, StatusBreakdown, Workload } from './dashboard-panels';
import { DashboardTaskList } from './dashboard-task-list';
import { PageSelectionBar } from './page-selection-bar';
import { PageSelectionProvider, PROJECT_SELECTION_KINDS } from '../lib/page-selection';
import type { BlockScope } from './configured-block';
import { limited, SECTION_DEFINITION, type BlockDefinition, type BlockRegistry } from './home-blocks';
import { SpaceStatusChip } from './space-status-chip';

interface Attribute {
  id: string;
  name: string;
  required: boolean;
  value: string;
}

interface ProjectContext {
  space: SpaceResponse;
  attributes: Attribute[];
  openTask: (taskId: string) => void;
  weekAhead: number;
}

/** The blocks a project's dashboard can hold. They close over the project, so the registry is built per project. */
function projectRegistry({ space, attributes, openTask, weekAhead }: ProjectContext): BlockRegistry {
  const blocks: Record<ProjectBlockType, BlockDefinition> = {
    'project-status': {
      title: 'Project status',
      description: 'Health, the note behind it, dates and project attributes',
      icon: InfoIcon,
      category: 'Project',
      skeleton: 'rows',
      size: { w: 12, h: 4 },
      render: () => (
        <div className="grid gap-6 lg:grid-cols-2">
          <div className="grid content-start gap-2">
            <p className="flex items-center gap-2 text-sm font-medium">
              <SpaceStatusChip status={space.status} />
              {space.startDate || space.dueDate ? (
                <span className="font-normal text-muted-foreground">
                  {space.startDate ? formatNumericDate(space.startDate) : '–'} → {space.dueDate ? formatNumericDate(space.dueDate) : '–'}
                </span>
              ) : null}
            </p>
            <p className="text-sm whitespace-pre-wrap text-muted-foreground">{space.statusNote || 'No explanation yet.'}</p>
          </div>
          <div className="grid content-start gap-2 lg:border-l lg:pl-6">
            {attributes.length === 0 ? <p className="text-sm text-muted-foreground">No attributes yet. Add project fields in the space settings.</p> : null}
            <dl className="grid grid-cols-[11rem_minmax(0,1fr)] gap-x-4 gap-y-2 text-sm">
              {attributes.map((attribute) => (
                <div key={attribute.id} className="contents">
                  <dt className="truncate text-muted-foreground">
                    {attribute.name}
                    {attribute.required ? <span className="text-critical"> *</span> : null}
                  </dt>
                  <dd className="truncate">{attribute.value}</dd>
                </div>
              ))}
            </dl>
          </div>
        </div>
      ),
    },
    kpis: {
      title: 'Key numbers',
      description: 'Open, overdue, due soon, done and hours at a glance',
      icon: GaugeIcon,
      category: 'Project',
      skeleton: 'rows',
      size: { w: 12, h: 4 },
      render: (data) => <KpiRow data={data} mode="project" />,
    },
    'status-breakdown': {
      title: 'Status breakdown',
      description: 'Every task in the project by status',
      icon: ChartBarStackedIcon,
      category: 'Insights',
      skeleton: 'rows',
      size: { w: 12, h: 3 },
      render: (data, config) => <StatusBreakdown data={data} openOnly={config.includeClosed === false} />,
    },
    'hours-per-day': {
      title: 'Hours per day',
      description: 'Time logged on this project, day by day',
      icon: ClockIcon,
      category: 'Time',
      skeleton: 'chart',
      size: { w: 6, h: 6 },
      render: (data, config) => <HoursPerDay data={data} height={200} chart={config.chart} />,
    },
    'hours-by-task': {
      title: 'Where the time went',
      description: 'The tasks with the most time logged',
      icon: TimerIcon,
      category: 'Time',
      skeleton: 'rows',
      size: { w: 6, h: 6 },
      aside: 'top tasks',
      render: (data) => <HoursByTask data={data} />,
    },
    phases: {
      title: 'Phases',
      description: 'Parent tasks with their subtasks: progress, time and status',
      icon: ListTreeIcon,
      category: 'Project',
      skeleton: 'rows',
      size: { w: 12, h: 7 },
      aside: 'parent tasks and their subtasks',
      render: (data) => <Phases data={data} openTask={openTask} />,
    },
    people: {
      title: 'People',
      description: 'Open work per person',
      icon: UsersRoundIcon,
      category: 'People',
      skeleton: 'rows',
      size: { w: 4, h: 7 },
      render: (data) => <Workload data={data} />,
    },
    'overdue-tasks': {
      title: 'Overdue',
      description: 'Open tasks past their due date',
      icon: TriangleAlertIcon,
      category: 'Tasks',
      skeleton: 'rows',
      size: { w: 4, h: 7 },
      chip: (data) => String(data.summary.overdue),
      render: (data, config) => <DashboardTaskList tasks={limited(data.overdueTasks, config)} fields={config.fields} variant="number" empty="Nothing overdue." />,
    },
    'due-soon-tasks': {
      title: 'Due in the next 7 days',
      description: 'Open tasks due within a week',
      icon: CalendarClockIcon,
      category: 'Tasks',
      skeleton: 'rows',
      size: { w: 4, h: 7 },
      chip: (data) => String(data.summary.dueSoon),
      render: (data, config) => (
        <DashboardTaskList
          tasks={limited(
            data.dueSoonTasks.filter((task) => task.dueDate && new Date(task.dueDate).getTime() < weekAhead),
            config,
          )}
          fields={config.fields}
          variant="number"
          empty="Nothing due this week."
        />
      ),
    },
    'recent-tasks': {
      title: 'Recently updated',
      description: 'The latest changes in this project',
      icon: HistoryIcon,
      category: 'Tasks',
      skeleton: 'rows',
      size: { w: 12, h: 6 },
      render: (data, config) => <DashboardTaskList tasks={limited(data.recentlyUpdated, config)} fields={config.fields} variant="number" date="updated" />,
    },
    section: SECTION_DEFINITION,
  };
  return { order: PROJECT_BLOCK_TYPES, blocks };
}

function Phases({ data, openTask }: { data: DashboardResponse; openTask: (taskId: string) => void }) {
  if (data.phases.length === 0) return <p className="py-4 text-center text-sm text-muted-foreground">No tasks with subtasks yet.</p>;
  return (
    <ul className="divide-y @container">
      {data.phases.map((phase) => (
        <li key={phase.id}>
          <button type="button" onClick={() => openTask(phase.id)} className="grid w-full grid-cols-[minmax(0,1fr)_auto] items-center gap-4 py-3 text-left hover:bg-muted/40 @xl:grid-cols-[minmax(0,1fr)_8rem_5rem_6rem_6rem]">
            <span className="min-w-0">
              <span className="block truncate font-medium">{phase.title}</span>
              <span className="block truncate text-xs text-muted-foreground">
                #{phase.number}
                {phase.assigneeName ? ` · ${phase.assigneeName}` : ''}
                {phase.dueDate ? ` · due ${formatNumericDate(phase.dueDate)}` : ''}
              </span>
            </span>
            <Meter value={phase.total ? (phase.done / phase.total) * 100 : 0} label={`${phase.title} progress`} className="hidden @xl:block" />
            <span className="text-sm tabular-nums text-muted-foreground">
              {phase.done}/{phase.total} done
            </span>
            <span className="hidden text-right text-sm tabular-nums @xl:inline">{phase.minutes ? formatMinutes(phase.minutes) : '–'}</span>
            <span className="hidden text-right text-sm text-muted-foreground @xl:inline">{phase.status.name}</span>
          </button>
        </li>
      ))}
    </ul>
  );
}

/**
 * One project at a glance, on the arrangeable block grid (E arranges, A adds a block).
 * Your arrangement is yours, and the same for every project.
 */
export function ProjectDashboard({ workspaceId, space }: { workspaceId: string; space: SpaceResponse }) {
  const { weekStart } = usePreferences();
  const queryClient = useQueryClient();
  const openTask = useOpenTask();
  const [period, setPeriod] = useState<Period>('this_month');
  const [weekAhead] = useState(() => Date.now() + 7 * 86_400_000);
  const dashboard = useDashboard(workspaceId, dashboardInput(period, weekStart, { spaceId: space.id }));
  const state = blockStateOf(dashboard, { what: 'this project' });
  const layout = useLayout(workspaceId, 'project');
  // A task list set to "mine" or some priorities asks for the same period and project, narrowed.
  const scope: BlockScope = { workspaceId, inputFor: ({ mine, userIds, priorities, categories }) => dashboardInput(period, weekStart, { spaceId: space.id, mine, userIds, priorities, categories }) };
  const { data: fields = [] } = useCustomFields(workspaceId, 'space');

  const registry = useMemo(() => {
    const attributes = fields
      .filter((field) => !field.spaceId || field.spaceId === space.id)
      .map((field) => {
        const value = space.customFields[field.id];
        const labels = (Array.isArray(value) ? value : [value]).map((item) => field.options.find((option) => option.id === item)?.label ?? item);
        return { id: field.id, name: field.name, required: field.required, value: value === null || value === undefined ? '–' : labels.join(', ') };
      });
    return projectRegistry({ space, attributes, openTask, weekAhead });
  }, [fields, space, openTask, weekAhead]);

  return (
    <PageSelectionProvider kinds={PROJECT_SELECTION_KINDS}>
    <div className="grid grid-cols-[minmax(0,1fr)] gap-4">
      <DashboardFilters
        period={period}
        onPeriod={setPeriod}
        weekStart={weekStart}
        note="hours are for this period, task counts are all-time"
        refreshing={dashboard.isFetching}
        onRefresh={() => void queryClient.invalidateQueries({ queryKey: queryKeys.dashboardRoot(workspaceId) })}
      />
      {dashboard.isError ? <ErrorState error={dashboard.error} onRetry={() => void dashboard.refetch()} /> : null}
      <PageSelectionBar />
      {!dashboard.isError ? <ArrangeableGrid layout={layout} canArrange data={dashboard.data} state={state} registry={registry} scope={scope} workspaceId={workspaceId} personal /> : null}
    </div>
    </PageSelectionProvider>
  );
}
