import { CalendarCheckIcon, CheckIcon, ChevronLeftIcon, ChevronRightIcon, MinusIcon, PlusIcon, RefreshCwIcon, ScaleIcon, SearchIcon, XIcon } from 'lucide-react';
import { useDeferredValue, useState } from 'react';
import { TIME_LIMITS } from '@taskflow/shared-types';
import { Segmented } from '@/components/kit/segmented';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { useCurrentUser } from '@/core/auth/use-current-user';
import { cn } from '@/lib/cn';
import { shiftDay, today } from '@/lib/days';
import { useSpaces } from '@/modules/spaces';
import { useSaveDailyLog, useSpaceStatuses, useTaskPicker, useTimeEntries } from '../hooks/use-time';
import { addMinutes, formatHours, instant, minutesOfClock } from '../lib/time-format';

const TARGETS = [4, 6, 7, 8, 9] as const;
type Chip = 'all' | 'started' | 'today' | 'selected';

interface Row {
  key: string;
  taskId: string | null;
  spaceId: string | null;
  title: string;
  hours: number;
  memo: string;
  /** '' keeps the status. */
  statusId: string;
}

const round = (hours: number) => Math.round(hours * 4) / 4;

/**
 * Log a whole day at once: tick the tasks you worked on, split the day's hours
 * between them (evenly or by hand), add a memo per task, then log everything
 * in one go. Rows run back to back from the start time.
 */
export function DailyLogPage({ workspaceId }: { workspaceId: string }) {
  const { data: me } = useCurrentUser();
  const { data: spaces = [] } = useSpaces(workspaceId);
  const [day, setDay] = useState(today());
  const [target, setTarget] = useState(8);
  const [start, setStart] = useState('09:00');
  const [search, setSearch] = useState('');
  const [chip, setChip] = useState<Chip>('all');
  const [rows, setRows] = useState<Row[]>([]);
  const [notes, setNotes] = useState('');
  const deferred = useDeferredValue(search.trim());
  const picker = useTaskPicker(workspaceId, { spaceId: null, search: deferred, mine: true, openOnly: true });
  const logged = useTimeEntries(workspaceId, { from: new Date(`${day}T00:00:00`).toISOString(), to: new Date(`${shiftDay(day, 1)}T00:00:00`).toISOString(), ...(me && { userIds: [me.id] }) }, Boolean(me));
  const statuses = useSpaceStatuses(workspaceId, rows.flatMap((row) => (row.spaceId ? [row.spaceId] : [])));
  const save = useSaveDailyLog(workspaceId);

  const tasks = picker.data?.items ?? [];
  const selected = new Set(rows.map((row) => row.taskId));
  const visible = tasks.filter((task) =>
    chip === 'started' ? task.status.category === 'started' : chip === 'today' ? task.updatedAt.slice(0, 10) === day : chip === 'selected' ? selected.has(task.id) : true,
  );
  const loggedMinutes = (logged.data ?? []).reduce((sum, entry) => sum + entry.minutes, 0);
  const splitHours = rows.reduce((sum, row) => sum + row.hours, 0);
  const spaceName = (spaceId: string | null) => spaces.find((space) => space.id === spaceId)?.name ?? 'No project';

  const toggle = (task: (typeof tasks)[number]) =>
    setRows((current) =>
      current.some((row) => row.taskId === task.id)
        ? current.filter((row) => row.taskId !== task.id)
        : [...current, { key: task.id, taskId: task.id, spaceId: task.spaceId, title: task.title, hours: 1, memo: '', statusId: '' }],
    );
  const patch = (key: string, change: Partial<Row>) => setRows((current) => current.map((row) => (row.key === key ? { ...row, ...change } : row)));
  const splitEvenly = () => {
    if (rows.length === 0) return;
    const each = round(target / rows.length);
    const lines = notes.split('\n').map((line) => line.replace(/^[-*•]\s*/, '').trim()).filter(Boolean);
    setRows((current) => current.map((row, index) => ({ ...row, hours: index === current.length - 1 ? round(target - each * (current.length - 1)) : each, memo: row.memo || lines[index] || '' })));
  };

  // Rows run back to back from the start time.
  const spans = rows.reduce<{ from: string; to: string }[]>((acc, row) => {
    const from = acc.at(-1)?.to ?? start;
    return [...acc, { from, to: addMinutes(from, Math.round(row.hours * 60)) }];
  }, []);
  const valid = rows.length > 0 && rows.every((row) => row.hours > 0) && splitHours * 60 <= TIME_LIMITS.entryMinutesMax && spans.every((span) => minutesOfClock(span.to) > minutesOfClock(span.from));

  const submit = () =>
    save.mutate(
      {
        entries: rows.map((row, index) => ({ taskId: row.taskId, spaceId: row.taskId ? null : row.spaceId, startedAt: instant(day, spans[index]!.from), endedAt: instant(day, spans[index]!.to), note: row.memo.trim() })),
        statusChanges: rows.flatMap((row) => (row.taskId && row.statusId ? [{ taskId: row.taskId, statusId: row.statusId }] : [])),
      },
      { onSuccess: () => setRows([]) },
    );

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-6 py-5">
      <header className="flex flex-wrap items-center gap-3">
        <h1 className="flex items-center gap-2 text-xl font-semibold">
          <CalendarCheckIcon className="size-5 text-primary" /> Daily log
        </h1>
        <Button variant="ghost" size="icon-sm" aria-label="Previous day" onClick={() => setDay(shiftDay(day, -1))}>
          <ChevronLeftIcon />
        </Button>
        <Input type="date" aria-label="Day" value={day} onChange={(event) => event.target.value && setDay(event.target.value)} className="h-8 w-40" />
        <Button variant="ghost" size="icon-sm" aria-label="Next day" onClick={() => setDay(shiftDay(day, 1))}>
          <ChevronRightIcon />
        </Button>
        <Segmented label="Hours to log" value={String(target) as `${number}`} onChange={(value) => setTarget(Number(value))} options={TARGETS.map((hours) => ({ value: `${hours}` as `${number}`, label: `${hours}h` }))} />
        <Input type="number" aria-label="Hours to log" min={0.25} max={24} step={0.25} value={target} onChange={(event) => setTarget(Number(event.target.value) || 0)} className="h-8 w-20" />
        <label className="flex items-center gap-2 text-sm text-muted-foreground">
          from <Input type="time" aria-label="Start time" value={start} onChange={(event) => setStart(event.target.value)} className="h-8 w-32" />
        </label>
        <span className="ml-auto text-sm text-muted-foreground">
          logged <span className="font-semibold text-foreground">{formatHours(loggedMinutes)}</span> · to log <span className="font-semibold text-primary">{formatHours(Math.max(0, target * 60 - loggedMinutes))}</span>
        </span>
        <Button variant="ghost" size="icon-sm" aria-label="Refresh" onClick={() => void logged.refetch()}>
          <RefreshCwIcon />
        </Button>
      </header>

      <div className="grid min-h-0 flex-1 gap-4 xl:grid-cols-[minmax(22rem,30rem)_minmax(0,1fr)]">
        <section className="flex min-h-[28rem] flex-col rounded-xl border bg-card" aria-label="Tasks">
          <h2 className="flex items-center gap-2 border-b px-4 py-3 font-semibold">
            1. Tasks <span className="text-xs font-normal text-muted-foreground tabular-nums">{rows.length}/{tasks.length}</span>
          </h2>
          <div className="grid gap-2 border-b p-3">
            <div className="relative">
              <SearchIcon className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search name or #number" aria-label="Search tasks" className="h-8 pl-8" />
            </div>
            <Segmented
              variant="pills"
              label="Show"
              value={chip}
              onChange={setChip}
              options={[
                { value: 'all', label: `All ${tasks.length}` },
                { value: 'started', label: `In progress ${tasks.filter((task) => task.status.category === 'started').length}` },
                { value: 'today', label: `Touched today ${tasks.filter((task) => task.updatedAt.slice(0, 10) === day).length}` },
                { value: 'selected', label: `Selected ${rows.filter((row) => row.taskId).length}` },
              ]}
            />
          </div>
          <ul className="min-h-0 flex-1 divide-y overflow-y-auto">
            {visible.map((task) => (
              <li key={task.id}>
                <label className={cn('flex cursor-pointer items-start gap-3 px-4 py-2.5 hover:bg-muted/50', selected.has(task.id) && 'bg-primary/5')}>
                  <Checkbox checked={selected.has(task.id)} onCheckedChange={() => toggle(task)} className="mt-0.5" />
                  <span className="mt-1.5 size-2 shrink-0 rounded-full" style={{ backgroundColor: task.status.color }} aria-hidden />
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-medium">{task.title}</span>
                    <span className="block truncate text-xs text-muted-foreground">
                      #{task.number} {spaceName(task.spaceId)}
                    </span>
                  </span>
                </label>
              </li>
            ))}
            {picker.data && visible.length === 0 ? <li className="p-6 text-center text-sm text-muted-foreground">No tasks here.</li> : null}
          </ul>
        </section>

        <div className="grid content-start gap-4">
          <section className="rounded-xl border border-primary/40 bg-card" aria-label="Split">
            <header className="flex items-center gap-2 border-b px-4 py-3">
              <h2 className="font-semibold">2. Split</h2>
              <span className={cn('rounded-md px-2 py-0.5 text-xs font-semibold tabular-nums', Math.abs(splitHours - target) < 0.01 ? 'bg-good/20' : 'bg-warning/20')}>
                {splitHours} h / {target} h
              </span>
              <span className="flex-1" />
              {rows.length ? (
                <button type="button" className="text-sm text-muted-foreground hover:text-foreground" onClick={() => setRows([])}>
                  Discard
                </button>
              ) : null}
            </header>
            <ul className="divide-y">
              {rows.map((row, index) => {
                const options = row.spaceId ? (statuses.data?.[row.spaceId] ?? []) : [];
                return (
                  <li key={row.key} className="grid gap-2 px-4 py-3">
                    <div className="flex items-center gap-2">
                      <span className="min-w-0 flex-1 truncate text-sm font-medium">{row.title}</span>
                      <span className="text-xs tabular-nums text-muted-foreground">
                        {spans[index]?.from}–{spans[index]?.to}
                      </span>
                      <Button variant="ghost" size="icon-sm" aria-label="Less time" onClick={() => patch(row.key, { hours: Math.max(0.25, round(row.hours - 0.25)) })}>
                        <MinusIcon />
                      </Button>
                      <Input
                        type="number"
                        aria-label={`Hours for ${row.title}`}
                        min={0.25}
                        step={0.25}
                        value={row.hours}
                        onChange={(event) => patch(row.key, { hours: Number(event.target.value) || 0 })}
                        className="h-8 w-20 text-center"
                      />
                      <Button variant="ghost" size="icon-sm" aria-label="More time" onClick={() => patch(row.key, { hours: round(row.hours + 0.25) })}>
                        <PlusIcon />
                      </Button>
                      <Button variant="ghost" size="icon-sm" aria-label={`Remove ${row.title}`} onClick={() => setRows((current) => current.filter((item) => item.key !== row.key))}>
                        <XIcon />
                      </Button>
                    </div>
                    <div className="flex gap-2">
                      <Input value={row.memo} maxLength={TIME_LIMITS.noteMax} onChange={(event) => patch(row.key, { memo: event.target.value })} placeholder="Memo" aria-label={`Memo for ${row.title}`} className="h-8 flex-1" />
                      {row.taskId ? (
                        <select value={row.statusId} onChange={(event) => patch(row.key, { statusId: event.target.value })} aria-label={`Status after logging ${row.title}`} className="h-8 w-44 rounded-md border bg-card px-2 text-sm">
                          <option value="">Keep status</option>
                          {options.map((status) => (
                            <option key={status.id} value={status.id}>
                              Set: {status.name}
                            </option>
                          ))}
                        </select>
                      ) : (
                        <select value={row.spaceId ?? ''} onChange={(event) => patch(row.key, { spaceId: event.target.value || null })} aria-label="Project" className="h-8 w-44 rounded-md border bg-card px-2 text-sm">
                          <option value="">Choose project</option>
                          {spaces.map((space) => (
                            <option key={space.id} value={space.id}>
                              {space.name}
                            </option>
                          ))}
                        </select>
                      )}
                    </div>
                  </li>
                );
              })}
              {rows.length === 0 ? <li className="px-4 py-8 text-center text-sm text-muted-foreground">Tick the tasks you worked on.</li> : null}
            </ul>
            <footer className="flex items-center gap-2 border-t px-4 py-3">
              <Button variant="ghost" size="sm" onClick={() => setRows((current) => [...current, { key: crypto.randomUUID(), taskId: null, spaceId: null, title: 'Work without a task', hours: 1, memo: '', statusId: '' }])}>
                <PlusIcon /> Work without a task
              </Button>
              <span className="flex-1" />
              <Button onClick={submit} disabled={!valid || save.isPending}>
                <CheckIcon /> Review & log {splitHours} h
              </Button>
            </footer>
          </section>

          <section className="rounded-xl border bg-card" aria-label="What did you do">
            <header className="flex items-center gap-2 border-b px-4 py-3">
              <h2 className="font-semibold">3. What did you do?</h2>
              <span className="text-xs text-muted-foreground">One line per thing; “Split evenly” shares the hours and hands the lines out to the rows in order.</span>
            </header>
            <div className="grid gap-3 p-4 md:grid-cols-[minmax(0,1fr)_12rem]">
              <Textarea value={notes} onChange={(event) => setNotes(event.target.value)} rows={5} aria-label="What you did" placeholder={'- Built the staff invitation API\n- Reviewed the permission PRs\n- 30 min client sync'} />
              <Button variant="outline" onClick={splitEvenly} disabled={rows.length === 0}>
                <ScaleIcon /> Split evenly
              </Button>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
