import { HOME_BLOCK_TYPES, type BlockConfig, type DashboardResponse, type HomeBlockType } from '@taskflow/shared-types';
import {
  CalendarClockIcon,
  CalendarRangeIcon,
  ChartBarStackedIcon,
  ClockIcon,
  FlagIcon,
  FolderKanbanIcon,
  HistoryIcon,
  HourglassIcon,
  TrendingUpIcon,
  TriangleAlertIcon,
  UsersIcon,
  UsersRoundIcon,
  type LucideIcon,
} from 'lucide-react';
import type { ReactNode } from 'react';
import { CreatedVsClosed, DueForecast, HoursByPerson, HoursByProject, HoursPerDay, OverdueAging, PriorityPanel, StatusBreakdown, Workload } from './dashboard-panels';
import { DashboardTaskList } from './dashboard-task-list';

export type BlockCategory = 'Project' | 'Tasks' | 'Insights' | 'Time' | 'People';

export interface BlockDefinition {
  title: string;
  description: string;
  icon: LucideIcon;
  category: BlockCategory;
  skeleton: 'rows' | 'chart';
  /** Size when added from the library. */
  size: { w: number; h: number };
  aside?: string;
  chip?: (data: DashboardResponse) => string | undefined;
  /** Draws the block from its data; `config` is the block's own settings (view and data source). */
  render: (data: DashboardResponse, config: BlockConfig) => ReactNode;
}

/** A task list cut to the block's limit, if it has one. */
const limited = <T,>(tasks: readonly T[], config: BlockConfig) => (config.limit ? tasks.slice(0, config.limit) : tasks);

/** Every block the Home page can hold (the order is the library's order). */
export const HOME_BLOCKS: Record<HomeBlockType, BlockDefinition> = {
  status: {
    title: 'Open work by status',
    description: 'Open tasks split by status',
    icon: ChartBarStackedIcon,
    category: 'Insights',
    skeleton: 'rows',
    size: { w: 4, h: 5 },
    render: (data, config) => <StatusBreakdown data={data} openOnly={!config.includeClosed} />,
  },
  priority: {
    title: 'Priority',
    description: 'Open tasks per priority, on time vs overdue',
    icon: FlagIcon,
    category: 'Insights',
    skeleton: 'rows',
    size: { w: 4, h: 5 },
    render: (data) => <PriorityPanel data={data} />,
  },
  'overdue-aging': {
    title: 'Overdue aging',
    description: 'How late the overdue tasks are',
    icon: HourglassIcon,
    category: 'Insights',
    skeleton: 'chart',
    size: { w: 4, h: 5 },
    chip: (data) => String(data.summary.overdue),
    render: (data) => <OverdueAging data={data} />,
  },
  'due-forecast': {
    title: 'Due-date forecast',
    description: 'Open tasks by the week they are due',
    icon: CalendarRangeIcon,
    category: 'Insights',
    skeleton: 'chart',
    size: { w: 6, h: 6 },
    aside: 'open tasks by due week',
    render: (data) => <DueForecast data={data} />,
  },
  'created-closed': {
    title: 'Created vs closed',
    description: 'Is the backlog growing or shrinking?',
    icon: TrendingUpIcon,
    category: 'Insights',
    skeleton: 'chart',
    size: { w: 6, h: 6 },
    aside: 'last 8 weeks',
    render: (data) => <CreatedVsClosed data={data} />,
  },
  'hours-per-day': {
    title: 'Hours per day',
    description: 'Time logged each day in the period',
    icon: ClockIcon,
    category: 'Time',
    skeleton: 'chart',
    size: { w: 4, h: 5 },
    render: (data) => <HoursPerDay data={data} />,
  },
  'hours-by-person': {
    title: 'Hours by person',
    description: 'Who logged the time',
    icon: UsersIcon,
    category: 'Time',
    skeleton: 'rows',
    size: { w: 4, h: 5 },
    render: (data) => <HoursByPerson data={data} />,
  },
  'hours-by-project': {
    title: 'Hours by project',
    description: 'Where the time went',
    icon: FolderKanbanIcon,
    category: 'Time',
    skeleton: 'rows',
    size: { w: 4, h: 5 },
    render: (data) => <HoursByProject data={data} />,
  },
  'overdue-tasks': {
    title: 'Overdue',
    description: 'Tasks past their due date',
    icon: TriangleAlertIcon,
    category: 'Tasks',
    skeleton: 'rows',
    size: { w: 4, h: 7 },
    chip: (data) => String(data.summary.overdue),
    render: (data, config) => <DashboardTaskList tasks={limited(data.overdueTasks, config)} empty="Nothing overdue." />,
  },
  'due-soon-tasks': {
    title: 'Due in the next 14 days',
    description: 'What is coming up',
    icon: CalendarClockIcon,
    category: 'Tasks',
    skeleton: 'rows',
    size: { w: 4, h: 7 },
    render: (data, config) => <DashboardTaskList tasks={limited(data.dueSoonTasks, config)} empty="Nothing due soon." />,
  },
  workload: {
    title: 'Team workload',
    description: 'Open tasks per person',
    icon: UsersRoundIcon,
    category: 'People',
    skeleton: 'rows',
    size: { w: 4, h: 7 },
    render: (data) => <Workload data={data} />,
  },
  'recent-tasks': {
    title: 'Recently updated',
    description: 'The latest changes across projects',
    icon: HistoryIcon,
    category: 'Tasks',
    skeleton: 'rows',
    size: { w: 12, h: 6 },
    render: (data, config) => <DashboardTaskList tasks={limited(data.recentlyUpdated, config)} date="updated" columns={2} />,
  },
};

/** The blocks a page can hold, in library order. */
export interface BlockRegistry {
  order: readonly string[];
  blocks: Readonly<Record<string, BlockDefinition>>;
}

export const HOME_REGISTRY: BlockRegistry = { order: HOME_BLOCK_TYPES, blocks: HOME_BLOCKS };
