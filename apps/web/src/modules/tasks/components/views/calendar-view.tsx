import { ChevronLeftIcon, ChevronRightIcon } from 'lucide-react';
import { useState } from 'react';
import { isClosedCategory, type TaskResponse } from '@taskflow/shared-types';
import { Button } from '@/components/ui/button';
import { usePreferences } from '@/core/preferences/use-preferences';
import { cn } from '@/lib/cn';
import { dayOf, daysBetween, dayToIso, formatDay, shiftDay, startOfWeekDay, today, weekday, type Day } from '@/lib/days';
import { useMemberName } from '@/modules/members';
import { usePermissions } from '@/modules/workspaces';
import { useTaskMutations } from '../../hooks/use-task-mutations';
import { TASK_DRAG_TYPE } from '../board-view/task-card';
import { PRIORITY_META } from '../../lib/task-meta';

const VISIBLE_PER_DAY = 3;

interface CalendarViewProps {
  workspaceId: string;
  tasks: readonly TaskResponse[];
  onOpen: (taskId: string) => void;
}

/** A month of due dates. Drag a task to another day to move its due date (and start, keeping the length). */
export function CalendarView({ workspaceId, tasks, onOpen }: CalendarViewProps) {
  const { weekStart } = usePreferences();
  const [month, setMonth] = useState(() => today().slice(0, 7));
  const { update } = useTaskMutations(workspaceId);
  const { canIn } = usePermissions(workspaceId);
  const canEditTask = (task: { spaceId: string }) => canIn(task.spaceId, 'task.update');
  const memberName = useMemberName(workspaceId);
  // A day shows a few tasks; "+N more" opens the rest in place.
  const [expanded, setExpanded] = useState<Day | null>(null);
  const now = today();

  const firstOfMonth: Day = `${month}-01`;
  const gridStart = startOfWeekDay(firstOfMonth, weekStart);
  const days = Array.from({ length: 42 }, (_, index) => shiftDay(gridStart, index));
  const byDay = new Map<Day, TaskResponse[]>();
  let undated = 0;
  for (const task of tasks) {
    const day = dayOf(task.dueDate) ?? dayOf(task.startDate);
    if (day) byDay.set(day, [...(byDay.get(day) ?? []), task]);
    else undated += 1;
  }
  const moveMonth = (delta: number) => {
    const date = new Date(Date.UTC(Number(month.slice(0, 4)), Number(month.slice(5, 7)) - 1 + delta, 1));
    setMonth(date.toISOString().slice(0, 7));
  };

  const moveTo = (taskId: string, day: Day) => {
    const task = tasks.find((item) => item.id === taskId);
    if (!task) return;
    const due = dayOf(task.dueDate);
    const start = dayOf(task.startDate);
    const delta = due ? daysBetween(due, day) : 0;
    update.mutate({
      taskId,
      body: {
        dueDate: dayToIso(day),
        ...(start && due && { startDate: dayToIso(shiftDay(start, delta)) }),
      },
    });
  };

  return (
    <div className="flex h-full min-h-[36rem] flex-col">
      <div className="flex items-center gap-2 pb-3">
        <h2 className="text-lg font-semibold">{formatDay(firstOfMonth, 'month')}</h2>
        {undated > 0 ? (
          <span className="text-xs text-muted-foreground">
            {undated} {undated === 1 ? 'task has' : 'tasks have'} no date
          </span>
        ) : null}
        <span className="flex-1" />
        <Button variant="outline" size="icon-sm" aria-label="Previous month" onClick={() => moveMonth(-1)}>
          <ChevronLeftIcon />
        </Button>
        <Button variant="outline" size="sm" onClick={() => setMonth(today().slice(0, 7))}>
          Today
        </Button>
        <Button variant="outline" size="icon-sm" aria-label="Next month" onClick={() => moveMonth(1)}>
          <ChevronRightIcon />
        </Button>
      </div>
      <div className="flex flex-1 flex-col overflow-clip rounded-xl border bg-card">
        <div className="grid grid-cols-7 border-b bg-muted/40 text-xs font-medium text-muted-foreground uppercase">
          {days.slice(0, 7).map((day) => (
            <div key={day} className="px-2 py-1.5">
              {formatDay(day, 'weekday')}
            </div>
          ))}
        </div>
        <div className="grid flex-1 grid-cols-7 [grid-template-rows:repeat(6,minmax(6rem,auto))]">
          {days.map((day, index) => {
            const items = byDay.get(day) ?? [];
            const inMonth = day.startsWith(month);
            const open = expanded === day;
            const shown = open ? items : items.slice(0, VISIBLE_PER_DAY);
            const weekend = weekday(day) === 0 || weekday(day) === 6;
            return (
              <div
                key={day}
                onDragOver={(event) => event.preventDefault()}
                onDrop={(event) => {
                  event.preventDefault();
                  const taskId = event.dataTransfer.getData(TASK_DRAG_TYPE);
                  if (taskId) moveTo(taskId, day);
                }}
                className={cn(
                  'flex min-h-24 min-w-0 flex-col gap-1 p-1.5',
                  index >= 7 && 'border-t',
                  index % 7 !== 0 && 'border-l',
                  !inMonth ? 'bg-muted/40' : weekend && 'bg-muted/15',
                  day === now && 'bg-primary/5',
                )}
              >
                <span
                  className={cn(
                    'self-end rounded-full px-1.5 text-xs tabular-nums',
                    day === now ? 'bg-primary font-semibold text-primary-foreground' : inMonth ? 'text-foreground' : 'text-muted-foreground',
                  )}
                >
                  {Number(day.slice(8))}
                </span>
                {shown.map((task) => {
                  const closed = isClosedCategory(task.status.category);
                  const overdue = !closed && dayOf(task.dueDate) !== null && dayOf(task.dueDate)! < now;
                  const assignee = memberName(task.assigneeIds?.[0] ?? task.assigneeId ?? null);
                  return (
                    <button
                      key={task.id}
                      type="button"
                      draggable={canEditTask(task)}
                      onDragStart={(event) => event.dataTransfer.setData(TASK_DRAG_TYPE, task.id)}
                      onClick={() => onOpen(task.id)}
                      title={[`#${task.number} ${task.title}`, assignee, overdue ? 'Overdue' : null].filter(Boolean).join(' · ')}
                      className={cn(
                        'flex min-w-0 items-center gap-1.5 rounded-md border border-l-[3px] bg-background px-1.5 py-1 text-left text-xs shadow-xs transition-colors hover:bg-muted',
                        closed && 'text-muted-foreground line-through',
                        overdue && 'border-destructive/40 bg-destructive/5 text-destructive',
                      )}
                      style={{ borderLeftColor: task.status.color }}
                    >
                      {task.priority !== 'none' ? (
                        <span className={cn('size-1.5 shrink-0 rounded-full', PRIORITY_META[task.priority].dot)} aria-label={`${PRIORITY_META[task.priority].label} priority`} />
                      ) : null}
                      <span className="min-w-0 flex-1 truncate">{task.title}</span>
                    </button>
                  );
                })}
                {items.length > VISIBLE_PER_DAY ? (
                  <button
                    type="button"
                    className="self-start rounded px-1 text-[11px] font-medium text-muted-foreground hover:bg-muted hover:text-foreground"
                    onClick={() => setExpanded(open ? null : day)}
                    aria-expanded={open}
                  >
                    {open ? 'Show less' : `+${items.length - VISIBLE_PER_DAY} more`}
                  </button>
                ) : null}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
