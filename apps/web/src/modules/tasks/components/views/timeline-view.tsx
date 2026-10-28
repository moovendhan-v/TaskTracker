import { useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
import type { TaskResponse } from '@taskflow/shared-types';
import { Segmented } from '@/components/kit/segmented';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/cn';
import { daysBetween, dayToIso, formatDay, shiftDay, taskSpan, today, type Day } from '@/lib/days';
import { formatNumericDate } from '@/lib/periods';
import { usePermissions } from '@/modules/workspaces';
import { useTaskMutations } from '../../hooks/use-task-mutations';
import { TYPE_META } from '../../lib/task-meta';

const ZOOMS = { day: 32, week: 14, month: 5 } as const;
type Zoom = keyof typeof ZOOMS;
const ROW = 40;

interface Drag {
  taskId: string;
  mode: 'move' | 'end';
  startX: number;
  deltaDays: number;
}

interface TimelineViewProps {
  workspaceId: string;
  tasks: readonly TaskResponse[];
  onOpen: (taskId: string) => void;
}

/**
 * Tasks as bars from start to due date. Drag a bar to move it, drag its right
 * end to change the due date. Tasks without dates are listed after the
 * scheduled ones.
 */
export function TimelineView({ workspaceId, tasks, onOpen }: TimelineViewProps) {
  const [zoom, setZoom] = useState<Zoom>('day');
  const [drag, setDrag] = useState<Drag | null>(null);
  const scroller = useRef<HTMLDivElement>(null);
  const { update } = useTaskMutations(workspaceId);
  const { canIn } = usePermissions(workspaceId);
  const canEditTask = (task: { spaceId: string }) => canIn(task.spaceId, 'task.update');
  const dayWidth = ZOOMS[zoom];

  const scheduled = tasks
    .map((task) => ({ task, span: taskSpan(task) }))
    // Latest work first; tasks without dates last.
    .sort((a, b) => (a.span && b.span ? daysBetween(a.span.start, b.span.start) : a.span ? -1 : b.span ? 1 : 0));
  const spans = scheduled.flatMap((row) => (row.span ? [row.span] : []));
  const now = today();
  const first = shiftDay(spans.reduce((min, span) => (span.start < min ? span.start : min), shiftDay(now, -7)), -3);
  const last = shiftDay(spans.reduce((max, span) => (span.end > max ? span.end : max), shiftDay(now, 21)), 7);
  const dayCount = daysBetween(first, last) + 1;
  const days = Array.from({ length: dayCount }, (_, index) => shiftDay(first, index));
  const x = (day: Day) => daysBetween(first, day) * dayWidth;

  const beginDrag = (event: ReactPointerEvent, taskId: string, mode: Drag['mode']) => {
    const task = tasks.find((item) => item.id === taskId);
    if (!task || !canEditTask(task)) return;
    event.preventDefault();
    event.stopPropagation();
    const startX = event.clientX;
    setDrag({ taskId, mode, startX, deltaDays: 0 });
    const onMove = (move: PointerEvent) => setDrag({ taskId, mode, startX, deltaDays: Math.round((move.clientX - startX) / dayWidth) });
    const onUp = (up: PointerEvent) => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      setDrag(null);
      const delta = Math.round((up.clientX - startX) / dayWidth);
      const task = tasks.find((item) => item.id === taskId);
      const span = task && taskSpan(task);
      if (!task || !span || delta === 0) return;
      if (mode === 'end') {
        const end = shiftDay(span.end, delta);
        if (end >= span.start) update.mutate({ taskId, body: { dueDate: dayToIso(end) } });
      } else {
        update.mutate({ taskId, body: { startDate: dayToIso(shiftDay(span.start, delta)), dueDate: dayToIso(shiftDay(span.end, delta)) } });
      }
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
  };

  const scrollToToday = () => scroller.current?.scrollTo({ left: Math.max(0, x(now) - 200), behavior: 'smooth' });

  return (
    <div className="flex h-full min-h-[30rem] flex-col">
      <div className="flex flex-wrap items-center gap-3 pb-3">
        <Segmented
          label="Zoom"
          value={zoom}
          onChange={setZoom}
          options={[
            { value: 'day', label: 'Day' },
            { value: 'week', label: 'Week' },
            { value: 'month', label: 'Month' },
          ]}
        />
        <Button variant="outline" size="sm" onClick={scrollToToday}>
          Today
        </Button>
        <span className="text-xs text-muted-foreground">
          {spans.length} of {tasks.length} scheduled · drag a bar to move it, drag its end to change the due date
        </span>
      </div>
      <div className="flex min-h-0 flex-1 overflow-hidden rounded-xl border bg-card">
        <div className="w-[26rem] shrink-0 border-r" role="rowgroup" aria-label="Tasks">
          <div className="grid h-12 grid-cols-[4rem_5rem_1fr] items-end gap-2 border-b px-3 pb-2 text-[11px] font-medium tracking-wide text-muted-foreground uppercase">
            <span>ID</span>
            <span>Type</span>
            <span>Subject</span>
          </div>
          {scheduled.map(({ task }) => (
            <div key={task.id} className="grid grid-cols-[4rem_5rem_1fr] items-center gap-2 border-b px-3 text-sm" style={{ height: ROW }}>
              <span className="tabular-nums text-chart-1">{task.number}</span>
              <span className="text-xs font-semibold uppercase text-muted-foreground">{TYPE_META[task.type].label}</span>
              <button type="button" onClick={() => onOpen(task.id)} className="truncate text-left font-medium hover:text-primary">
                {task.title}
              </button>
            </div>
          ))}
        </div>
        <div ref={scroller} className="min-w-0 flex-1 overflow-x-auto">
          <div className="relative" style={{ width: dayCount * dayWidth }}>
            <div className="sticky top-0 z-[1] flex h-12 border-b bg-card">
              {days.map((day) => (
                <div
                  key={day}
                  className={cn('flex shrink-0 flex-col justify-end border-l pb-1.5 text-center text-[11px] text-muted-foreground', day === now && 'font-semibold text-primary')}
                  style={{ width: dayWidth }}
                >
                  {day.endsWith('-01') ? <span className="absolute top-1 pl-1 text-xs font-medium text-foreground">{formatDay(day, 'month')}</span> : null}
                  {zoom === 'day' || (zoom === 'week' && day.endsWith('1')) ? Number(day.slice(8)) : ''}
                </div>
              ))}
            </div>
            <div className="pointer-events-none absolute top-12 bottom-0 border-l-2 border-dashed border-critical/70" style={{ left: x(now) + dayWidth / 2 }} aria-hidden />
            {scheduled.map(({ task, span }) => {
              const moving = drag?.taskId === task.id ? drag : null;
              const start = span ? shiftDay(span.start, moving?.mode === 'move' ? moving.deltaDays : 0) : null;
              const end = span ? shiftDay(span.end, moving ? moving.deltaDays : 0) : null;
              const length = start && end ? Math.max(1, daysBetween(start, end) + 1) : 0;
              return (
                <div key={task.id} className="relative border-b" style={{ height: ROW }}>
                  {start && end ? (
                    <>
                      <div
                        role="button"
                        tabIndex={0}
                        aria-label={`${task.title}: ${formatNumericDate(start)} to ${formatNumericDate(end)}`}
                        onPointerDown={(event) => beginDrag(event, task.id, 'move')}
                        onDoubleClick={() => onOpen(task.id)}
                        onKeyDown={(event) => event.key === 'Enter' && onOpen(task.id)}
                        className={cn('absolute top-2 flex h-6 items-center rounded-md border-2 px-1.5 text-[11px] font-semibold', canEditTask(task) && 'cursor-grab active:cursor-grabbing')}
                        style={{ left: x(start), width: length * dayWidth, borderColor: task.status.color, backgroundColor: `color-mix(in oklab, ${task.status.color} 22%, transparent)` }}
                      >
                        {length > 1 && length * dayWidth > 28 ? `${length}d` : ''}
                        {canEditTask(task) ? <span onPointerDown={(event) => beginDrag(event, task.id, 'end')} className="absolute top-0 right-0 bottom-0 w-2 cursor-ew-resize" aria-hidden /> : null}
                      </div>
                      <span className="pointer-events-none absolute top-2.5 truncate text-[11px] whitespace-nowrap text-muted-foreground italic" style={{ left: x(end) + dayWidth + 6 }}>
                        {formatNumericDate(end)} {task.title}
                      </span>
                    </>
                  ) : (
                    <span className="absolute top-2.5 left-2 text-xs text-muted-foreground">No dates</span>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
