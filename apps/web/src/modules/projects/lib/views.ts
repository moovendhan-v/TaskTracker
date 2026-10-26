import { CalendarDaysIcon, ChartGanttIcon, ClockIcon, KanbanIcon, LayoutDashboardIcon, ListIcon, RocketIcon, Table2Icon, UsersIcon, UsersRoundIcon, type LucideIcon } from 'lucide-react';

export const PROJECT_VIEWS = ['list', 'board', 'table', 'calendar', 'timeline', 'planner', 'time', 'sprints', 'members', 'dashboard'] as const;
export type ProjectView = (typeof PROJECT_VIEWS)[number];

/** Views that show the project's tasks and share the task toolbar. */
export const TASK_VIEWS: readonly ProjectView[] = ['list', 'board', 'table', 'calendar', 'timeline', 'planner'];

export const VIEW_META: Record<ProjectView, { label: string; icon: LucideIcon; tint: string }> = {
  list: { label: 'List', icon: ListIcon, tint: 'text-chart-1' },
  board: { label: 'Board', icon: KanbanIcon, tint: 'text-chart-1' },
  table: { label: 'Table', icon: Table2Icon, tint: 'text-good' },
  calendar: { label: 'Calendar', icon: CalendarDaysIcon, tint: 'text-chart-2' },
  timeline: { label: 'Timeline', icon: ChartGanttIcon, tint: 'text-critical' },
  planner: { label: 'Team planner', icon: UsersRoundIcon, tint: 'text-good' },
  time: { label: 'Time', icon: ClockIcon, tint: 'text-warning' },
  sprints: { label: 'Sprints', icon: RocketIcon, tint: 'text-chart-1' },
  members: { label: 'Members', icon: UsersIcon, tint: 'text-muted-foreground' },
  dashboard: { label: 'Dashboard', icon: LayoutDashboardIcon, tint: 'text-primary' },
};

export function isProjectView(value: string): value is ProjectView {
  return (PROJECT_VIEWS as readonly string[]).includes(value);
}
