import { ChevronLeftIcon, ChevronRightIcon } from 'lucide-react';
import { useState } from 'react';
import { isClosedCategory, type TaskResponse } from '@taskflow/shared-types';
import { UserAvatar } from '@/components/common/user-avatar';
import { Segmented } from '@/components/kit/segmented';
import { Button } from '@/components/ui/button';
import { usePreferences } from '@/core/preferences/use-preferences';
import { cn } from '@/lib/cn';
import { daysBetween, dayToIso, formatDay, shiftDay, startOfWeekDay, taskSpan, today, type Day } from '@/lib/days';
import { formatNumericDate } from '@/lib/periods';
import { useMembers } from '@/modules/members';
import { usePermissions } from '@/modules/workspaces';
import { useTaskMutations } from '../../hooks/use-task-mutations';
import { TASK_DRAG_TYPE } from '../board-view/task-card';

const BUSY_DAY = 3;
const LANE = 30;

interface Placed {
  task: TaskResponse;
  start: Day;
  end: Day;
  lane: number;
}

/** Packs bars into the fewest lanes so overlapping tasks sit under each other. */
function packLanes(items: { task: TaskResponse; start: Day; end: Day }[]): Placed[] {
  const laneEnds: Day[] = [];
  return items
    .sort((a, b) => daysBetween(b.start, a.start) || daysBetween(b.end, a.end))
    .map((item) => {
      let lane = laneEnds.findIndex((end) => end < item.start);
      if (lane === -1) lane = laneEnds.length;
      laneEnds[lane] = item.end;
      return { ...item, lane };
    });
}

interface PlannerViewProps {
  workspaceId: string;
  tasks: readonly TaskResponse[];
  onOpen: (taskId: string) => void;
}

/**
 * Who works on what, when: a row per person, a column per day. Drop a bar on
 * another person or day to hand it over or move it; drop an unscheduled task
 * to give it a day. Days with three or more tasks for one person are tinted.
 */
export function PlannerView({ workspaceId, tasks, onOpen }: PlannerViewProps) {
  const { weekStart } = usePreferences();
  const [weeks, setWeeks] = useState<'1' | '2' | '4'>('2');
  const [from, setFrom] = useState(() => startOfWeekDay(today(), weekStart));
  const { data: members = [] } = useMembers(workspaceId);
  const { update } = useTaskMutations(workspaceId);
  const { canIn } = usePermissions(workspaceId);
  const canEditTask = (task: { spaceId: string }) => canIn(task.spaceId, 'task.update') && canIn(task.spaceId, 'task.assign');
  const dayCount = Number(weeks) * 7;
  const to = shiftDay(from, dayCount - 1);
  const days = Array.from({ length: dayCount }, (_, index) => shiftDay(from, index));
  const now = today();

  const open = tasks.filter((task) => !isClosedCategory(task.status.category));
  const unscheduled = open.filter((task) => !taskSpan(task));
  const inWindow = open.flatMap((task) => {
    const span = taskSpan(task);
    if (!span || span.end < from || span.start > to) return [];
    return [{ task, start: span.start < from ? from : span.start, end: span.end > to ? to : span.end }];
  });

  const drop = (taskId: string, userId: string, day: Day) => {
    const task = tasks.find((item) => item.id === taskId);
    if (!task) return;
    const span = taskSpan(task);
    const length = span ? daysBetween(span.start, span.end) : 0;
    update.mutate({ taskId, body: { assigneeId: userId, startDate: dayToIso(day), dueDate: dayToIso(shiftDay(day, length)) } });
  };

  return (
    <div className="flex h-full min-h-[30rem] flex-col">
      <div className="flex flex-wrap items-center gap-3 pb-3">
        <Segmented
          label="Weeks shown"
          value={weeks}
          onChange={setWeeks}
          options={[
            { value: '1', label: '1 week' },
            { value: '2', label: '2 weeks' },
            { value: '4', label: '4 weeks' },
          ]}
        />
        <Button variant="ghost" size="icon-sm" aria-label="Earlier" onClick={() => setFrom(shiftDay(from, -7))}>
          <ChevronLeftIcon />
        </Button>
        <Button variant="outline" size="sm" onClick={() => setFrom(startOfWeekDay(now, weekStart))}>
          This week
        </Button>
        <Button variant="ghost" size="icon-sm" aria-label="Later" onClick={() => setFrom(shiftDay(from, 7))}>
          <ChevronRightIcon />
        </Button>
        <span className="text-sm tabular-nums">
          {formatNumericDate(from)} – {formatNumericDate(to)}
        </span>
        <span className="ml-auto text-xs text-muted-foreground">Drag a bar to move it or hand it to someone · tinted days have {BUSY_DAY}+ tasks</span>
      </div>
      <div className="flex min-h-0 flex-1 gap-3">
        <div className="min-w-0 flex-1 overflow-auto rounded-xl border bg-card">
          <div className="grid" style={{ gridTemplateColumns: `13rem repeat(${dayCount}, minmax(4.5rem, 1fr))` }}>
            <div className="sticky left-0 z-[2] border-r border-b bg-card px-3 py-2 text-[11px] font-medium tracking-wide text-muted-foreground uppercase">Person</div>
            {days.map((day) => (
              <div key={day} className={cn('border-b border-l px-1 py-1.5 text-center text-[11px] leading-tight', day === now ? 'bg-primary/15 font-semibold text-primary' : 'text-muted-foreground')}>
                {formatDay(day, 'weekday')}
                <br />
                {formatDay(day, 'monthDay')}
              </div>
            ))}
            {members.map((member) => {
              const placed = packLanes(inWindow.filter((item) => item.task.assigneeId === member.userId));
              const lanes = Math.max(1, ...placed.map((item) => item.lane + 1));
              const busy = (day: Day) => placed.filter((item) => item.start <= day && item.end >= day).length >= BUSY_DAY;
              return (
                <div key={member.userId} className="contents">
                  <div className="sticky left-0 z-[1] flex items-center gap-2 border-r border-b bg-card px-3 text-sm" style={{ minHeight: lanes * LANE + 16 }}>
                    <UserAvatar name={member.name} className="size-7" />
                    <span className="min-w-0 flex-1 truncate">{member.name}</span>
                    <span className="text-xs tabular-nums text-muted-foreground">{placed.length}</span>
                  </div>
                  <div className="relative border-b" style={{ gridColumn: `span ${dayCount}` }}>
                    <div className="absolute inset-0 grid" style={{ gridTemplateColumns: `repeat(${dayCount}, minmax(4.5rem, 1fr))` }}>
                      {days.map((day) => (
                        <div
                          key={day}
                          onDragOver={(event) => event.preventDefault()}
                          onDrop={(event) => {
                            event.preventDefault();
                            const taskId = event.dataTransfer.getData(TASK_DRAG_TYPE);
                            if (taskId) drop(taskId, member.userId, day);
                          }}
                          className={cn('border-l', busy(day) && 'bg-warning/10', day === now && 'bg-primary/5')}
                        />
                      ))}
                    </div>
                    <div className="pointer-events-none relative grid py-2" style={{ gridTemplateColumns: `repeat(${dayCount}, minmax(4.5rem, 1fr))`, gridAutoRows: LANE }}>
                      {placed.map((item) => (
                        <button
                          key={item.task.id}
                          type="button"
                          draggable={canEditTask(item.task)}
                          onDragStart={(event) => event.dataTransfer.setData(TASK_DRAG_TYPE, item.task.id)}
                          onClick={() => onOpen(item.task.id)}
                          className="pointer-events-auto mx-0.5 my-0.5 truncate rounded border-l-4 bg-muted px-2 text-left text-xs hover:bg-accent"
                          style={{ gridColumn: `${daysBetween(from, item.start) + 1} / span ${daysBetween(item.start, item.end) + 1}`, gridRow: item.lane + 1, borderLeftColor: item.task.status.color }}
                          title={item.task.title}
                        >
                          {item.task.title}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
        <aside className="flex w-64 shrink-0 flex-col rounded-xl border bg-card" aria-label="Unscheduled tasks">
          <h3 className="border-b px-3 py-2.5 text-sm font-semibold">
            Unscheduled <span className="font-normal text-muted-foreground">{unscheduled.length}</span>
          </h3>
          <div className="grid content-start gap-1.5 overflow-y-auto p-2">
            {unscheduled.length === 0 ? <p className="p-4 text-center text-sm text-muted-foreground">Every open task has a date.</p> : null}
            {unscheduled.map((task) => (
              <button
                key={task.id}
                type="button"
                draggable={canEditTask(task)}
                onDragStart={(event) => event.dataTransfer.setData(TASK_DRAG_TYPE, task.id)}
                onClick={() => onOpen(task.id)}
                className="truncate rounded-md border-l-4 bg-muted px-2 py-1.5 text-left text-xs hover:bg-accent"
                style={{ borderLeftColor: task.status.color }}
              >
                {task.title}
              </button>
            ))}
          </div>
        </aside>
      </div>
    </div>
  );
}
