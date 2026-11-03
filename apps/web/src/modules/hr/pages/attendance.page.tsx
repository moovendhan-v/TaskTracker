import { ChevronLeftIcon, ChevronRightIcon, CoffeeIcon, LogInIcon, LogOutIcon, TimerIcon } from 'lucide-react';
import { useEffect, useState } from 'react';
import { PageHeader } from '@/components/common/page-header';
import { UserAvatar } from '@/components/common/user-avatar';
import { Button } from '@/components/ui/button';
import { usePreferences } from '@/core/preferences/use-preferences';
import { cn } from '@/lib/cn';
import { addDays, startOfWeek } from '@/lib/periods';
import { useMemberName } from '@/modules/members';
import { usePermissions } from '@/modules/workspaces';
import { useClock, useMyAttendance, useTeamAttendance } from '../hooks/use-attendance';
import { formatWorked, localDate, teamWeek } from '../lib/attendance';

const time = (iso: string) => new Date(iso).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });

/** A clock that re-renders every 30 seconds, so running totals move. */
function useNow(): Date {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 30_000);
    return () => clearInterval(timer);
  }, []);
  return now;
}

/** Clock in and out of your day, with breaks; HR managers also see the team's week. */
export function AttendancePage({ workspaceId }: { workspaceId: string }) {
  const { can } = usePermissions(workspaceId);
  return (
    <div className="flex-1 overflow-y-auto">
      <PageHeader title="Attendance" description="Clock in and out of your working day" icon={<TimerIcon className="size-5 text-muted-foreground" />} />
      <div className="mx-auto grid max-w-5xl gap-8 p-6">
        <MyClock workspaceId={workspaceId} />
        {can('hr.manage') ? <TeamWeek workspaceId={workspaceId} /> : null}
      </div>
    </div>
  );
}

function MyClock({ workspaceId }: { workspaceId: string }) {
  const now = useNow();
  const { data, isLoading, dataUpdatedAt } = useMyAttendance(workspaceId);
  const clock = useClock(workspaceId);
  const busy = clock.clockIn.isPending || clock.clockOut.isPending || clock.startBreak.isPending || clock.endBreak.isPending;
  const current = data?.current ?? null;
  // The server's total as of the last fetch, plus the time since, unless on a break.
  const worked = current ? current.workedMinutes + (current.onBreak ? 0 : Math.max(0, Math.floor((now.getTime() - dataUpdatedAt) / 60_000))) : 0;
  const runningBreak = current?.breaks.find((item) => item.end === null);
  const today = localDate(now.toISOString());
  const todayTotal = (data?.recent ?? []).filter((shift) => shift.endedAt !== null && localDate(shift.startedAt) === today).reduce((sum, shift) => sum + shift.workedMinutes, 0) + worked;

  return (
    <section aria-labelledby="my-clock" className="grid gap-4">
      <div className="flex flex-wrap items-center gap-4 rounded-xl border bg-card p-5">
        <span className={cn('grid size-11 place-items-center rounded-full', current ? (current.onBreak ? 'bg-amber-500/15 text-amber-600' : 'bg-emerald-500/15 text-emerald-600') : 'bg-muted text-muted-foreground')}>
          {current?.onBreak ? <CoffeeIcon className="size-5" /> : <TimerIcon className="size-5" />}
        </span>
        <div className="min-w-0 flex-1">
          <h2 id="my-clock" className="text-base font-semibold" aria-live="polite">
            {isLoading ? 'Loading…' : !current ? 'You’re not clocked in' : current.onBreak ? `On a break since ${time(runningBreak!.start)}` : `Working since ${time(current.startedAt)}`}
          </h2>
          <p className="text-sm text-muted-foreground">
            {current ? `${formatWorked(worked)} worked this shift · ` : ''}
            {formatWorked(todayTotal)} today
          </p>
        </div>
        {!current ? (
          <Button disabled={busy || isLoading} onClick={() => clock.clockIn.mutate()}>
            <LogInIcon /> Clock in
          </Button>
        ) : (
          <>
            {current.onBreak ? (
              <Button variant="outline" disabled={busy} onClick={() => clock.endBreak.mutate()}>
                <TimerIcon /> End break
              </Button>
            ) : (
              <Button variant="outline" disabled={busy} onClick={() => clock.startBreak.mutate()}>
                <CoffeeIcon /> Start break
              </Button>
            )}
            <Button disabled={busy} onClick={() => clock.clockOut.mutate()}>
              <LogOutIcon /> Clock out
            </Button>
          </>
        )}
      </div>

      <div className="grid gap-2">
        <h3 className="text-sm font-semibold">Your recent shifts</h3>
        {data && data.recent.length === 0 ? <p className="text-sm text-muted-foreground">No shifts yet.</p> : null}
        <ul aria-label="Your recent shifts" className="divide-y rounded-xl border bg-card">
          {data?.recent.map((shift) => (
            <li key={shift.id} className="flex flex-wrap items-center gap-3 px-4 py-2.5 text-sm">
              <span className="w-28 font-medium">{new Date(shift.startedAt).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })}</span>
              <span className="tabular-nums text-muted-foreground">
                {time(shift.startedAt)} – {shift.endedAt ? time(shift.endedAt) : 'now'}
              </span>
              <span className="text-xs text-muted-foreground">
                {shift.breaks.length ? `${shift.breaks.length} break${shift.breaks.length === 1 ? '' : 's'}` : 'no breaks'}
              </span>
              <span className="flex-1" />
              <span className="tabular-nums">{formatWorked(shift.workedMinutes)}</span>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

function TeamWeek({ workspaceId }: { workspaceId: string }) {
  const { weekStart } = usePreferences();
  const nameOf = useMemberName(workspaceId);
  const now = useNow();
  const [offset, setOffset] = useState(0);
  const start = addDays(startOfWeek(new Date(), weekStart), offset * 7);
  const end = addDays(start, 7);
  const days = Array.from({ length: 7 }, (_, index) => addDays(start, index));
  const dayKeys = days.map((day) => localDate(day.toISOString()));
  const { data: shifts = [], isLoading } = useTeamAttendance(workspaceId, start.toISOString(), end.toISOString(), true);
  const rows = teamWeek(shifts, dayKeys, now).sort((a, b) => (nameOf(a.userId) ?? '').localeCompare(nameOf(b.userId) ?? ''));
  const label = `${start.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })} – ${addDays(end, -1).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}`;

  return (
    <section aria-labelledby="team-week" className="grid gap-3">
      <div className="flex items-center gap-2">
        <h2 id="team-week" className="text-sm font-semibold">
          Team attendance
        </h2>
        <span className="text-xs text-muted-foreground">hours worked per day, breaks excluded</span>
        <span className="flex-1" />
        <Button variant="ghost" size="icon-sm" aria-label="Previous week" onClick={() => setOffset(offset - 1)}>
          <ChevronLeftIcon />
        </Button>
        <span className="min-w-36 text-center text-sm font-medium" aria-live="polite">
          {label}
        </span>
        <Button variant="ghost" size="icon-sm" aria-label="Next week" disabled={offset >= 0} onClick={() => setOffset(offset + 1)}>
          <ChevronRightIcon />
        </Button>
      </div>
      <div className={cn('overflow-x-auto rounded-xl border bg-card', isLoading && 'opacity-60')}>
        <table className="w-full text-sm" aria-label={`Team attendance, ${label}`}>
          <thead>
            <tr className="border-b">
              <th scope="col" className="px-4 py-2 text-left font-mono text-[10.5px] font-semibold tracking-[0.06em] text-subtle-foreground uppercase">
                Person
              </th>
              {days.map((day) => (
                <th key={day.toISOString()} scope="col" className="px-2 py-2 text-right font-mono text-[10.5px] font-semibold tracking-[0.06em] text-subtle-foreground uppercase">
                  {day.toLocaleDateString(undefined, { weekday: 'short', day: 'numeric' })}
                </th>
              ))}
              <th scope="col" className="px-4 py-2 text-right font-mono text-[10.5px] font-semibold tracking-[0.06em] text-subtle-foreground uppercase">
                Total
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={9} className="px-4 py-6 text-center text-muted-foreground">
                  Nobody clocked in this week.
                </td>
              </tr>
            ) : null}
            {rows.map((row) => {
              const name = nameOf(row.userId) ?? 'Former member';
              return (
                <tr key={row.userId} className="border-b last:border-b-0">
                  <th scope="row" className="px-4 py-2 text-left font-normal">
                    <span className="flex items-center gap-2">
                      <UserAvatar name={name} className="size-6 text-[10px]" />
                      <span className="truncate">{name}</span>
                      {row.now ? (
                        <span className={cn('rounded-full px-1.5 py-0.5 text-[10.5px] font-medium', row.now === 'in' ? 'bg-emerald-500/10 text-emerald-700' : 'bg-amber-500/10 text-amber-700')}>
                          {row.now === 'in' ? 'In now' : 'On break'}
                        </span>
                      ) : null}
                    </span>
                  </th>
                  {dayKeys.map((day) => (
                    <td key={day} className="px-2 py-2 text-right tabular-nums text-muted-foreground">
                      {row.minutes[day] ? <span className="text-foreground">{formatWorked(row.minutes[day])}</span> : '–'}
                    </td>
                  ))}
                  <td className="px-4 py-2 text-right font-medium tabular-nums">{formatWorked(row.total)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}
