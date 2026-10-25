import type { DashboardResponse } from '@taskflow/shared-types';
import { StatusPill } from '@/components/kit/status-pill';
import { cn } from '@/lib/cn';
import { isOverdue } from '@/lib/dates';
import { formatNumericDate } from '@/lib/periods';
import { useOpenTask } from '@/modules/tasks';

type Task = DashboardResponse['overdueTasks'][number];

interface DashboardTaskListProps {
  tasks: readonly Task[];
  /** `number`: #123 first (project dashboards); `context`: project and assignee under the title. */
  variant?: 'number' | 'context';
  date?: 'due' | 'updated';
  columns?: 1 | 2;
  empty?: string;
}

/** Compact task rows for dashboard panels: title, status and a date. Click opens the task. */
export function DashboardTaskList({ tasks, variant = 'context', date = 'due', columns = 1, empty = 'Nothing here.' }: DashboardTaskListProps) {
  const openTask = useOpenTask();
  if (tasks.length === 0) return <p className="py-6 text-center text-sm text-muted-foreground">{empty}</p>;
  return (
    <ul className={cn('grid gap-x-8', columns === 2 && 'lg:grid-cols-2')}>
      {tasks.map((task) => {
        const when = date === 'due' ? task.dueDate : task.updatedAt;
        const late = date === 'due' && isOverdue(task.dueDate) && task.status.category !== 'done' && task.status.category !== 'cancelled';
        return (
          <li key={task.id}>
            <button type="button" onClick={() => openTask(task.id)} className="grid w-full grid-cols-[minmax(0,1fr)_auto_4.5rem] items-center gap-3 rounded-md px-1 py-2 text-left hover:bg-muted/50">
              <span className="min-w-0">
                <span className="block truncate text-sm font-medium">
                  {variant === 'number' ? <span className="mr-3 text-muted-foreground tabular-nums">#{task.number}</span> : null}
                  {task.title}
                </span>
                {variant === 'context' ? (
                  <span className="block truncate text-xs text-muted-foreground">
                    {task.spaceName}
                    {task.assigneeName ? ` · ${task.assigneeName}` : ''}
                  </span>
                ) : null}
              </span>
              <StatusPill status={task.status} />
              <span className={cn('text-right text-sm tabular-nums', late ? 'text-critical' : date === 'due' && when ? 'text-warning' : 'text-muted-foreground')}>{when ? formatNumericDate(when) : '–'}</span>
            </button>
          </li>
        );
      })}
    </ul>
  );
}
