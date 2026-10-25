import { ChevronLeftIcon, ChevronRightIcon, ClockIcon, PlusIcon } from 'lucide-react';
import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
import type { TimeEntryResponse } from '@taskflow/shared-types';
import { Button } from '@/components/ui/button';
import { useCurrentUser } from '@/core/auth/use-current-user';
import { usePreferences } from '@/core/preferences/use-preferences';
import { cn } from '@/lib/cn';
import { formatDay, shiftDay, startOfWeekDay, today, type Day } from '@/lib/days';
import { useSpaces } from '@/modules/spaces';
import { LogTimeDialog, type LogTimeDefaults } from '../components/log-time-dialog';
import { useTimeEntries, useTimeMutations } from '../hooks/use-time';
import { formatHours, instant } from '../lib/time-format';

const HOUR = 56;
const FIRST_VISIBLE_HOUR = 7;
const SNAPS = [5, 15, 30] as const;

const localDay = (date: Date): Day => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
const minutesOfDay = (date: Date) => date.getHours() * 60 + date.getMinutes();
const toClock = (minutes: number) => `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`;

type Gesture =
  | { kind: 'select'; day: Day; anchor: number; current: number }
  | { kind: 'move' | 'resize'; entry: TimeEntryResponse; originY: number; deltaMinutes: number; day: Day; originDay: Day };

/**
 * The signed-in person's week. Drag on a day to log the selected hours, drag a
 * block to move it (also to another day), drag its bottom edge to resize it.
 * Everything snaps to the chosen step.
 */
export function TimesheetsPage({ workspaceId }: { workspaceId: string }) {
  const { weekStart } = usePreferences();
  const { data: me } = useCurrentUser();
  const { data: spaces = [] } = useSpaces(workspaceId);
  const [from, setFrom] = useState(() => startOfWeekDay(today(), weekStart));
  const [snap, setSnap] = useState<(typeof SNAPS)[number]>(5);
  const [dialog, setDialog] = useState<{ defaults?: LogTimeDefaults; entry?: TimeEntryResponse } | null>(null);
  const [gesture, setGesture] = useState<Gesture | null>(null);
  const grid = useRef<HTMLDivElement>(null);
  const { update } = useTimeMutations(workspaceId);
  const days = Array.from({ length: 7 }, (_, index) => shiftDay(from, index));
  const range = { from: new Date(`${from}T00:00:00`).toISOString(), to: new Date(`${shiftDay(from, 7)}T00:00:00`).toISOString() };
  const entries = useTimeEntries(workspaceId, { ...range, ...(me && { userIds: [me.id] }) }, Boolean(me));
  const list = (entries.data ?? []).filter((entry) => entry.endedAt);
  const total = list.reduce((sum, entry) => sum + entry.minutes, 0);
  const colorOf = (entry: TimeEntryResponse) => spaces.find((space) => space.id === entry.spaceId)?.color ?? '#6d28d9';
  const now = new Date();

  useEffect(() => {
    grid.current?.scrollTo({ top: FIRST_VISIBLE_HOUR * HOUR });
  }, []);

  const snapTo = (minutes: number) => Math.max(0, Math.min(24 * 60, Math.round(minutes / snap) * snap));
  const minuteAt = (event: { clientY: number }, column: HTMLElement) => snapTo(((event.clientY - column.getBoundingClientRect().top) / HOUR) * 60);
  const dayAt = (event: { clientX: number; clientY: number }): Day | null => {
    const element = document.elementFromPoint(event.clientX, event.clientY)?.closest<HTMLElement>('[data-day]');
    return (element?.dataset['day'] as Day | undefined) ?? null;
  };

  const startSelect = (event: ReactPointerEvent<HTMLDivElement>, day: Day) => {
    if (event.button !== 0 || (event.target as HTMLElement).closest('[data-entry]')) return;
    const column = event.currentTarget;
    const anchor = minuteAt(event, column);
    setGesture({ kind: 'select', day, anchor, current: anchor + snap });
    const onMove = (move: PointerEvent) => setGesture({ kind: 'select', day, anchor, current: minuteAt(move, column) });
    const onUp = (up: PointerEvent) => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      setGesture(null);
      const end = minuteAt(up, column);
      const [a, b] = anchor <= end ? [anchor, Math.max(end, anchor + snap)] : [end, anchor];
      setDialog({ defaults: { day, from: toClock(a), to: toClock(Math.min(b, 23 * 60 + 59)) } });
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
  };

  const startDrag = (event: ReactPointerEvent, entry: TimeEntryResponse, kind: 'move' | 'resize') => {
    event.stopPropagation();
    event.preventDefault();
    const originY = event.clientY;
    const originDay = localDay(new Date(entry.startedAt));
    let moved = false;
    const state = (move: { clientX: number; clientY: number }): Gesture => ({
      kind,
      entry,
      originY,
      originDay,
      deltaMinutes: snapTo(Math.abs(((move.clientY - originY) / HOUR) * 60)) * Math.sign(move.clientY - originY),
      day: kind === 'move' ? (dayAt(move) ?? originDay) : originDay,
    });
    setGesture(state(event));
    const onMove = (move: PointerEvent) => {
      moved = moved || Math.abs(move.clientY - originY) > 3;
      setGesture(state(move));
    };
    const onUp = (up: PointerEvent) => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      const final = state(up);
      setGesture(null);
      if (!moved && final.kind !== 'select' && final.day === originDay) return setDialog({ entry });
      if (final.kind === 'select') return;
      const start = new Date(entry.startedAt);
      const startMinute = minutesOfDay(start);
      if (kind === 'resize') {
        const length = Math.max(snap, entry.minutes + final.deltaMinutes);
        update.mutate({ entryId: entry.id, input: { endedAt: instant(originDay, toClock(Math.min(startMinute + length, 23 * 60 + 59))) } });
      } else {
        const newStart = Math.max(0, startMinute + final.deltaMinutes);
        update.mutate({ entryId: entry.id, input: { startedAt: instant(final.day, toClock(newStart)), endedAt: instant(final.day, toClock(Math.min(newStart + entry.minutes, 23 * 60 + 59))) } });
      }
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3 px-6 py-5">
      <header className="flex flex-wrap items-center gap-3">
        <h1 className="flex items-center gap-2 text-xl font-semibold">
          <ClockIcon className="size-5 text-primary" /> My spent time
        </h1>
        <Button variant="outline" size="icon-sm" aria-label="Previous week" onClick={() => setFrom(shiftDay(from, -7))}>
          <ChevronLeftIcon />
        </Button>
        <Button variant="outline" size="icon-sm" aria-label="Next week" onClick={() => setFrom(shiftDay(from, 7))}>
          <ChevronRightIcon />
        </Button>
        <Button variant="outline" size="sm" onClick={() => setFrom(startOfWeekDay(today(), weekStart))}>
          Today
        </Button>
        <span className="text-sm font-medium">
          {formatDay(from, 'monthDay')} – {formatDay(shiftDay(from, 6), 'monthDay')}, {from.slice(0, 4)}
        </span>
        <span className="flex-1" />
        <label className="flex items-center gap-2 text-sm text-muted-foreground">
          Snap to
          <select value={snap} onChange={(event) => setSnap(Number(event.target.value) as (typeof SNAPS)[number])} className="h-8 rounded-md border bg-card px-2 text-foreground">
            {SNAPS.map((value) => (
              <option key={value} value={value}>
                {value} min
              </option>
            ))}
          </select>
        </label>
        <span className="rounded-md bg-muted px-3 py-1.5 text-sm font-semibold tabular-nums">Total: {formatHours(total)}</span>
        <Button size="sm" onClick={() => setDialog({})}>
          <PlusIcon /> Log time
        </Button>
      </header>
      <p className="text-xs text-muted-foreground">Drag on a day to select hours, drag a block to move it, drag its bottom edge to resize. Times snap to {snap} minutes.</p>

      <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-xl border bg-card">
        <div className="grid grid-cols-[4rem_repeat(7,minmax(0,1fr))] border-b">
          <span />
          {days.map((day) => {
            const minutes = list.filter((entry) => localDay(new Date(entry.startedAt)) === day).reduce((sum, entry) => sum + entry.minutes, 0);
            return (
              <div key={day} className={cn('border-l py-2 text-center', day === today() && 'bg-primary/10 text-primary')}>
                <div className="text-sm font-semibold">
                  {formatDay(day, 'weekday')} {Number(day.slice(5, 7))}/{Number(day.slice(8))}
                </div>
                <div className="text-xs text-muted-foreground tabular-nums">{formatHours(minutes)}</div>
              </div>
            );
          })}
        </div>
        <div ref={grid} className="relative min-h-0 flex-1 overflow-y-auto">
          <div className="grid grid-cols-[4rem_repeat(7,minmax(0,1fr))]" style={{ height: 24 * HOUR }}>
            <div className="relative">
              {Array.from({ length: 24 }, (_, hour) => (
                <span key={hour} className="absolute right-2 -translate-y-1/2 text-[11px] text-muted-foreground tabular-nums" style={{ top: hour * HOUR }}>
                  {hour ? `${String(hour).padStart(2, '0')}:00` : ''}
                </span>
              ))}
            </div>
            {days.map((day) => {
              const dayEntries = list.filter((entry) => localDay(new Date(entry.startedAt)) === day);
              const selecting = gesture?.kind === 'select' && gesture.day === day ? gesture : null;
              const dragging = gesture && gesture.kind !== 'select' && gesture.day === day && gesture.originDay !== day ? gesture : null;
              return (
                <div key={day} data-day={day} onPointerDown={(event) => startSelect(event, day)} className={cn('relative cursor-crosshair border-l select-none', day === today() && 'bg-primary/[0.03]')}>
                  {Array.from({ length: 24 }, (_, hour) => (
                    <div key={hour} className="pointer-events-none absolute inset-x-0 border-t border-chart-grid" style={{ top: hour * HOUR }} />
                  ))}
                  {day === today() ? <div className="pointer-events-none absolute inset-x-0 z-[2] border-t-2 border-critical" style={{ top: (minutesOfDay(now) / 60) * HOUR }} aria-hidden /> : null}
                  {selecting ? (
                    <div
                      className="pointer-events-none absolute inset-x-1 rounded-md border-2 border-dashed border-primary bg-primary/15"
                      style={{ top: (Math.min(selecting.anchor, selecting.current) / 60) * HOUR, height: (Math.max(snap, Math.abs(selecting.current - selecting.anchor)) / 60) * HOUR }}
                    />
                  ) : null}
                  {[...dayEntries, ...(dragging ? [dragging.entry] : [])].map((entry) => {
                    const active = gesture && gesture.kind !== 'select' && gesture.entry.id === entry.id ? gesture : null;
                    if (active && active.kind === 'move' && active.day !== day) return null;
                    const start = minutesOfDay(new Date(entry.startedAt)) + (active?.kind === 'move' ? active.deltaMinutes : 0);
                    const length = Math.max(snap, entry.minutes + (active?.kind === 'resize' ? active.deltaMinutes : 0));
                    return (
                      <div
                        key={entry.id}
                        data-entry
                        role="button"
                        tabIndex={0}
                        aria-label={`${formatHours(entry.minutes)} ${entry.task?.title ?? entry.spaceName ?? 'Time'}`}
                        onPointerDown={(event) => startDrag(event, entry, 'move')}
                        onKeyDown={(event) => event.key === 'Enter' && setDialog({ entry })}
                        className={cn('absolute inset-x-1 z-[1] cursor-grab overflow-hidden rounded-md px-2 py-1 text-[11px] leading-tight text-white shadow-sm', active && 'z-[3] opacity-90 ring-2 ring-white/70')}
                        style={{ top: (start / 60) * HOUR + 1, height: (length / 60) * HOUR - 2, backgroundColor: colorOf(entry) }}
                      >
                        <div className="font-semibold">
                          {formatHours(length)} {toClock(start)}–{toClock(Math.min(start + length, 24 * 60))}
                        </div>
                        <div className="truncate">
                          {entry.spaceName ?? 'No project'}
                          {entry.task ? ` - #${entry.task.number}: ${entry.task.title}` : ''}
                        </div>
                        {entry.note ? <div className="truncate opacity-85">{entry.note}</div> : null}
                        <span onPointerDown={(event) => startDrag(event, entry, 'resize')} className="absolute inset-x-0 bottom-0 h-1.5 cursor-ns-resize bg-black/20" aria-hidden />
                      </div>
                    );
                  })}
                </div>
              );
            })}
          </div>
        </div>
      </div>
      {dialog ? <LogTimeDialog workspaceId={workspaceId} open onOpenChange={(open) => !open && setDialog(null)} defaults={dialog.defaults} entry={dialog.entry ?? null} /> : null}
    </div>
  );
}

