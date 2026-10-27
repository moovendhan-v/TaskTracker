import { ChevronLeftIcon, ChevronRightIcon } from 'lucide-react';
import { useState } from 'react';
import { isClosedCategory, type TaskResponse } from '@taskflow/shared-types';
import { Button } from '@/components/ui/button';
import { usePreferences } from '@/core/preferences/use-preferences';
import { cn } from '@/lib/cn';
import { dayOf, daysBetween, dayToIso, formatDay, shiftDay, startOfWeekDay, today, type Day } from '@/lib/days';
import { usePermissions } from '@/modules/workspaces';
import { useTaskMutations } from '../../hooks/use-task-mutations';
import { TASK_DRAG_TYPE } from '../board-view/task-card';

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

  const firstOfMonth: Day = `${month}-01`;
  const gridStart = startOfWeekDay(firstOfMonth, weekStart);
  const days = Array.from({ length: 42 }, (_, index) => shiftDay(gridStart, index));
  const byDay = new Map<Day, TaskResponse[]>();
  for (const task of tasks) {
    const day = dayOf(task.dueDate) ?? dayOf(task.startDate);
    if (day) byDay.set(day, [...(byDay.get(day) ?? []), task]);
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
    update.mutate({ taskId, body: { dueDate: dayToIso(day), ...(start && due && { startDate: dayToIso(shiftDay(start, delta)) }) } });
  };

  return (
    <div className="flex h-full min-h-[36rem] flex-col">
      <div className="flex items-center gap-2 pb-3">
        <h2 className="text-lg font-semibold">{formatDay(firstOfMonth, 'month')}</h2>
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
      <div className="grid grid-cols-7 border-b text-xs font-medium text-muted-foreground uppercase">
        {days.slice(0, 7).map((day) => (
          <div key={day} className="px-2 py-1.5">
            {formatDay(day, 'weekday')}
          </div>
        ))}
      </div>
      <div className="grid flex-1 grid-cols-7 grid-rows-6 overflow-hidden rounded-b-xl border-x border-b">
        {days.map((day) => {
          const items = byDay.get(day) ?? [];
          const inMonth = day.startsWith(month);
          return (
            <div
              key={day}
              onDragOver={(event) => event.preventDefault()}
              onDrop={(event) => {
                event.preventDefault();
                const taskId = event.dataTransfer.getData(TASK_DRAG_TYPE);
                if (taskId) moveTo(taskId, day);
              }}
              className={cn('flex min-h-24 flex-col gap-1 border-t border-l p-1.5 first:border-l-0 [&:nth-child(7n+1)]:border-l-0', !inMonth && 'bg-muted/30')}
            >
              <span className={cn('self-end rounded-full px-1.5 text-xs tabular-nums', day === today() ? 'bg-primary font-semibold text-primary-foreground' : inMonth ? 'text-foreground' : 'text-muted-foreground')}>
                {Number(day.slice(8))}
              </span>
              {items.slice(0, VISIBLE_PER_DAY).map((task) => (
                <button
                  key={task.id}
                  type="button"
                  draggable={canEditTask(task)}
                  onDragStart={(event) => event.dataTransfer.setData(TASK_DRAG_TYPE, task.id)}
                  onClick={() => onOpen(task.id)}
                  className={cn('flex items-center gap-1.5 truncate rounded border-l-2 bg-card px-1.5 py-0.5 text-left text-xs hover:bg-muted', isClosedCategory(task.status.category) && 'text-muted-foreground line-through')}
                  style={{ borderLeftColor: task.status.color }}
                >
                  <span className="truncate">{task.title}</span>
                </button>
              ))}
              {items.length > VISIBLE_PER_DAY ? <span className="px-1 text-[11px] text-muted-foreground">+{items.length - VISIBLE_PER_DAY} more</span> : null}
            </div>
          );
        })}
      </div>
    </div>
  );
}
