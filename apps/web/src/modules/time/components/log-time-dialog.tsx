import { ChevronLeftIcon, ChevronRightIcon, SearchIcon } from 'lucide-react';
import { useDeferredValue, useState } from 'react';
import { TIME_LIMITS, type TimeEntryResponse } from '@taskflow/shared-types';
import { ColorDot } from '@/components/common/color-dot';
import { Modal } from '@/components/kit/modal';
import { Segmented } from '@/components/kit/segmented';
import { StatusPill } from '@/components/kit/status-pill';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/cn';
import { shiftDay, today } from '@/lib/days';
import { useMemberName } from '@/modules/members';
import { useSpaces } from '@/modules/spaces';
import { useTaskPicker, useTimeMutations } from '../hooks/use-time';
import { addMinutes, clock, formatMinutes, instant, minutesOfClock } from '../lib/time-format';

const QUICK = [15, 30, 60, 90, 120, 240] as const;

export interface PickedTask {
  id: string;
  number: number;
  title: string;
  spaceId: string | null;
}

export interface LogTimeDefaults {
  task?: PickedTask | null;
  day?: string;
  from?: string;
  to?: string;
  note?: string;
}

interface LogTimeDialogProps {
  workspaceId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaults?: LogTimeDefaults;
  /** Edit this entry instead of logging a new one. */
  entry?: TimeEntryResponse | null;
}

/** Log a span of time on a task: pick the project and task, the day and the times. */
export function LogTimeDialog({ workspaceId, open, onOpenChange, defaults, entry }: LogTimeDialogProps) {
  const start = entry ? new Date(entry.startedAt) : null;
  const end = entry?.endedAt ? new Date(entry.endedAt) : null;
  const [spaceId, setSpaceId] = useState<string | null>(entry?.spaceId ?? defaults?.task?.spaceId ?? null);
  const [task, setTask] = useState<PickedTask | null>(entry?.task ? { ...entry.task, spaceId: entry.spaceId } : (defaults?.task ?? null));
  const [day, setDay] = useState(start ? `${start.getFullYear()}-${String(start.getMonth() + 1).padStart(2, '0')}-${String(start.getDate()).padStart(2, '0')}` : (defaults?.day ?? today()));
  const [from, setFrom] = useState(() => (start ? clock(start) : (defaults?.from ?? clock(new Date(Date.now() - 60 * 60_000)))));
  const [to, setTo] = useState(() => (end ? clock(end) : (defaults?.to ?? clock(new Date()))));
  const [note, setNote] = useState(entry?.note ?? defaults?.note ?? '');
  const [search, setSearch] = useState('');
  const [mine, setMine] = useState<'me' | 'anyone'>('me');
  const [openOnly, setOpenOnly] = useState<'open' | 'all'>('open');
  const [projectFilter, setProjectFilter] = useState('');
  const deferredSearch = useDeferredValue(search.trim());
  const { data: spaces = [] } = useSpaces(workspaceId);
  const memberName = useMemberName(workspaceId);
  const picker = useTaskPicker(workspaceId, { spaceId, search: deferredSearch, mine: mine === 'me', openOnly: openOnly === 'open' });
  const { log, update } = useTimeMutations(workspaceId);
  const duration = minutesOfClock(to) - minutesOfClock(from);
  const valid = duration > 0 && duration <= TIME_LIMITS.entryMinutesMax;
  const saving = log.isPending || update.isPending;

  const save = () => {
    const body = { taskId: task?.id ?? null, spaceId: task ? null : spaceId, startedAt: instant(day, from), endedAt: instant(day, to), note: note.trim() };
    const done = { onSuccess: () => onOpenChange(false) };
    if (entry) update.mutate({ entryId: entry.id, input: body }, done);
    else log.mutate(body, done);
  };

  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      title={entry ? 'Edit time' : 'Log time'}
      size="xl"
      tall
      footer={
        <>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={save} disabled={!valid || saving || (!task && !spaceId)}>
            Save
          </Button>
        </>
      }
    >
      <div className="grid h-full min-h-0 gap-4 p-5 lg:grid-cols-[14rem_minmax(0,1fr)_20rem]">
        <section aria-label="Project" className="flex min-h-0 flex-col rounded-lg border">
          <h3 className="px-3 pt-3 text-[11px] font-semibold tracking-wider text-muted-foreground uppercase">Project</h3>
          <div className="p-2">
            <Input value={projectFilter} onChange={(event) => setProjectFilter(event.target.value)} placeholder="Find project" aria-label="Find project" className="h-8" />
          </div>
          <div className="grid content-start gap-0.5 overflow-y-auto px-2 pb-2">
            {[{ id: null, name: 'All projects', color: null }, ...spaces]
              .filter((space) => space.id === null || space.name.toLowerCase().includes(projectFilter.toLowerCase()))
              .map((space) => (
                <button
                  key={space.id ?? 'all'}
                  type="button"
                  onClick={() => setSpaceId(space.id)}
                  className={cn('flex items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm hover:bg-muted', spaceId === space.id && 'bg-accent font-medium')}
                >
                  {space.color ? <ColorDot color={space.color} /> : null}
                  <span className="truncate">{space.name}</span>
                </button>
              ))}
          </div>
        </section>

        <section aria-label="Tasks" className="flex min-h-0 flex-col rounded-lg border">
          <div className="relative border-b">
            <SearchIcon className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
            <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search tasks by name or #number" aria-label="Search tasks" className="h-10 w-full bg-transparent pr-3 pl-9 text-sm outline-none" />
          </div>
          <div className="flex flex-wrap items-center gap-3 border-b px-3 py-2 text-xs text-muted-foreground">
            Assignee
            <Segmented label="Assignee" value={mine} onChange={setMine} options={[{ value: 'me', label: 'Me' }, { value: 'anyone', label: 'Anyone' }]} />
            Status
            <Segmented label="Status" value={openOnly} onChange={setOpenOnly} options={[{ value: 'open', label: 'Open' }, { value: 'all', label: 'All' }]} />
            <span className="ml-auto tabular-nums">{picker.data?.total ?? 0} tasks</span>
          </div>
          <ul className="min-h-0 flex-1 divide-y overflow-y-auto">
            {(picker.data?.items ?? []).map((item) => (
              <li key={item.id}>
                <button
                  type="button"
                  onClick={() => setTask({ id: item.id, number: item.number, title: item.title, spaceId: item.spaceId })}
                  className={cn('grid w-full grid-cols-[3.5rem_minmax(0,1fr)_auto] items-center gap-2 px-3 py-2 text-left hover:bg-muted', task?.id === item.id && 'bg-primary/10')}
                >
                  <span className="text-xs tabular-nums text-muted-foreground">#{item.number}</span>
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-medium">{item.title}</span>
                    <span className="block truncate text-xs text-muted-foreground">
                      {spaces.find((space) => space.id === item.spaceId)?.name}
                      {item.assigneeId ? ` · ${memberName(item.assigneeId) ?? ''}` : ''}
                    </span>
                  </span>
                  <StatusPill status={item.status} />
                </button>
              </li>
            ))}
            {picker.data && picker.data.items.length === 0 ? <li className="p-6 text-center text-sm text-muted-foreground">No tasks match.</li> : null}
          </ul>
        </section>

        <section aria-label="Entry" className="grid content-start gap-4">
          <div className="grid gap-1.5">
            <h3 className="text-[11px] font-semibold tracking-wider text-muted-foreground uppercase">Task</h3>
            {task ? (
              <div className="flex items-center gap-2 rounded-lg border bg-muted/40 px-3 py-2 text-sm">
                <span className="text-xs tabular-nums text-muted-foreground">#{task.number}</span>
                <span className="min-w-0 flex-1 truncate font-medium">{task.title}</span>
                <button type="button" className="text-xs text-muted-foreground hover:text-foreground" onClick={() => setTask(null)}>
                  Clear
                </button>
              </div>
            ) : (
              <p className="rounded-lg border border-dashed px-3 py-4 text-center text-sm text-muted-foreground">
                {spaceId ? 'No task: logs on the project' : 'Choose a task from the list'}
              </p>
            )}
          </div>
          <div className="grid gap-1.5">
            <label htmlFor="log-day" className="text-[11px] font-semibold tracking-wider text-muted-foreground uppercase">
              Day
            </label>
            <div className="flex items-center gap-1.5">
              <Button variant="outline" size="icon-sm" aria-label="Previous day" onClick={() => setDay(shiftDay(day, -1))}>
                <ChevronLeftIcon />
              </Button>
              <Input id="log-day" type="date" value={day} onChange={(event) => event.target.value && setDay(event.target.value)} className="h-8 flex-1" />
              <Button variant="outline" size="icon-sm" aria-label="Next day" onClick={() => setDay(shiftDay(day, 1))}>
                <ChevronRightIcon />
              </Button>
              <Button variant="outline" size="sm" onClick={() => setDay(today())}>
                Today
              </Button>
            </div>
          </div>
          <div className="grid gap-1.5">
            <span className="text-[11px] font-semibold tracking-wider text-muted-foreground uppercase">Time</span>
            <div className="flex items-center gap-2">
              <Input type="time" aria-label="From" value={from} onChange={(event) => setFrom(event.target.value)} className="h-9" />
              <span aria-hidden>→</span>
              <Input type="time" aria-label="To" value={to} onChange={(event) => setTo(event.target.value)} className="h-9" />
            </div>
            <div className="flex flex-wrap gap-1.5">
              {QUICK.map((minutes) => (
                <button key={minutes} type="button" onClick={() => setTo(addMinutes(from, minutes))} className="rounded-full border px-2.5 py-0.5 text-xs hover:bg-muted">
                  {minutes < 60 ? `${minutes} min` : `${minutes / 60} h`}
                </button>
              ))}
            </div>
            <p className={cn('text-sm', valid ? 'text-muted-foreground' : 'text-critical')} role="status">
              Duration <span className="text-lg font-semibold text-foreground">{duration > 0 ? formatMinutes(duration) : '—'}</span>
              {!valid ? ' · the end must be after the start' : null}
            </p>
          </div>
          <div className="grid gap-1.5">
            <label htmlFor="log-note" className="text-[11px] font-semibold tracking-wider text-muted-foreground uppercase">
              Comment
            </label>
            <Textarea id="log-note" value={note} maxLength={TIME_LIMITS.noteMax} onChange={(event) => setNote(event.target.value)} placeholder="What did you work on? (optional)" rows={4} />
          </div>
        </section>
      </div>
    </Modal>
  );
}
