import type { DashboardResponse, TaskListField, TaskPriority } from '@taskflow/shared-types';
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
  /** Columns picked in the block's settings, in order; the title always shows. Unset keeps the default look. */
  fields?: readonly TaskListField[];
}

const PRIORITY_LABEL: Record<TaskPriority, string> = { urgent: 'Urgent', high: 'High', normal: 'Normal', low: 'Low', none: '–' };
const PRIORITY_TONE: Partial<Record<TaskPriority, string>> = { urgent: 'text-critical', high: 'text-warning' };

/** Compact task rows for dashboard panels: title, status and a date. Click opens the task. */
export function DashboardTaskList({ tasks, variant = 'context', date = 'due', columns = 1, empty = 'Nothing here.', fields }: DashboardTaskListProps) {
  const openTask = useOpenTask();
  if (tasks.length === 0) return <p className="py-6 text-center text-sm text-muted-foreground">{empty}</p>;
  if (fields) return <FieldRows tasks={tasks} fields={fields} date={date} columns={columns} onOpen={openTask} />;
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

/** Rows with the columns a block's settings picked, in that order. */
function FieldRows({ tasks, fields, date, columns, onOpen }: { tasks: readonly Task[]; fields: readonly TaskListField[]; date: 'due' | 'updated'; columns: 1 | 2; onOpen: (taskId: string) => void }) {
  const cells = fields.filter((field) => field !== 'number');
  return (
    <ul className={cn('grid grid-cols-[minmax(0,1fr)] gap-x-8', columns === 2 && 'lg:grid-cols-2')}>
      {tasks.map((task) => {
        const when = date === 'due' ? task.dueDate : task.updatedAt;
        const late = date === 'due' && isOverdue(task.dueDate) && task.status.category !== 'done' && task.status.category !== 'cancelled';
        const cell = (field: TaskListField) => {
          switch (field) {
            case 'status':
              return <StatusPill status={task.status} />;
            case 'priority':
              return <span className={cn('text-xs', PRIORITY_TONE[task.priority] ?? 'text-muted-foreground')}>{PRIORITY_LABEL[task.priority]}</span>;
            case 'date':
              return <span className={cn('text-sm tabular-nums', late ? 'text-critical' : date === 'due' && when ? 'text-warning' : 'text-muted-foreground')}>{when ? formatNumericDate(when) : '–'}</span>;
            case 'assignee':
              return <span className="max-w-32 truncate text-xs text-muted-foreground">{task.assigneeName ?? 'Unassigned'}</span>;
            case 'project':
              return <span className="max-w-32 truncate text-xs text-muted-foreground">{task.spaceName}</span>;
            default:
              return null;
          }
        };
        return (
          <li key={task.id}>
            <button type="button" onClick={() => onOpen(task.id)} className="flex w-full items-center gap-3 rounded-md px-1 py-2 text-left hover:bg-muted/50">
              <span className="min-w-0 flex-1 truncate text-sm font-medium">
                {fields.includes('number') ? <span className="mr-3 text-muted-foreground tabular-nums">#{task.number}</span> : null}
                {task.title}
              </span>
              {cells.map((field) => (
                <span key={field} className="flex shrink-0 items-center">
                  {cell(field)}
                </span>
              ))}
            </button>
          </li>
        );
      })}
    </ul>
  );
}
