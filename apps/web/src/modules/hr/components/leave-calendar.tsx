import { ChevronLeftIcon, ChevronRightIcon } from 'lucide-react';
import { useMemo, useState } from 'react';
import { UserAvatar } from '@/components/common/user-avatar';
import { Button } from '@/components/ui/button';
import { usePreferences } from '@/core/preferences/use-preferences';
import { cn } from '@/lib/cn';
import { useMemberName } from '@/modules/members';
import { useLeaveCalendar } from '../hooks/use-hr';
import { awayByDay, monthGrid } from '../lib/leave-calendar';

const SHOWN = 3;

/**
 * Who is away this month, as a month grid. It shows approved leave as dates and
 * names only: the type and reason stay with the person and their approvers.
 */
export function LeaveCalendar({ workspaceId }: { workspaceId: string }) {
  const { weekStart } = usePreferences();
  const nameOf = useMemberName(workspaceId);
  const [month, setMonth] = useState(() => {
    const now = new Date();
    return { year: now.getFullYear(), month: now.getMonth() };
  });
  const weeks = useMemo(() => monthGrid(month.year, month.month, weekStart), [month, weekStart]);
  const from = weeks[0]![0]!.date;
  const to = weeks.at(-1)!.at(-1)!.date;
  const { data: absences = [], isLoading } = useLeaveCalendar(workspaceId, from, to);
  const away = useMemo(() => awayByDay(weeks, absences, (userId) => nameOf(userId) ?? 'A teammate'), [weeks, absences, nameOf]);
  const today = new Date().toLocaleDateString('en-CA');
  const title = new Date(Date.UTC(month.year, month.month, 1)).toLocaleDateString(undefined, { month: 'long', year: 'numeric', timeZone: 'UTC' });
  const dayNames = weeks[0]!.map((day) => new Date(`${day.date}T00:00:00Z`).toLocaleDateString(undefined, { weekday: 'short', timeZone: 'UTC' }));
  const shift = (by: number) => setMonth(({ year, month: current }) => ({ year: current + by < 0 ? year - 1 : current + by > 11 ? year + 1 : year, month: (current + by + 12) % 12 }));

  return (
    <section aria-labelledby="leave-calendar" className="grid gap-3">
      <div className="flex items-center gap-2">
        <h2 id="leave-calendar" className="text-sm font-semibold">
          Who’s away
        </h2>
        <span className="text-xs text-muted-foreground">approved time off, dates only</span>
        <span className="flex-1" />
        <Button variant="ghost" size="icon-sm" aria-label="Previous month" onClick={() => shift(-1)}>
          <ChevronLeftIcon />
        </Button>
        <span className="min-w-32 text-center text-sm font-medium" aria-live="polite">
          {title}
        </span>
        <Button variant="ghost" size="icon-sm" aria-label="Next month" onClick={() => shift(1)}>
          <ChevronRightIcon />
        </Button>
      </div>
      <table className={cn('w-full table-fixed border-collapse overflow-hidden rounded-xl border bg-card text-sm', isLoading && 'opacity-60')} aria-label={`Who’s away, ${title}`}>
        <thead>
          <tr>
            {dayNames.map((name) => (
              <th key={name} scope="col" className="border-b py-1.5 text-center font-mono text-[10.5px] font-semibold tracking-[0.06em] text-subtle-foreground uppercase">
                {name}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {weeks.map((week) => (
            <tr key={week[0]!.date}>
              {week.map((day) => {
                const people = away.get(day.date) ?? [];
                const label = new Date(`${day.date}T00:00:00Z`).toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric', timeZone: 'UTC' });
                return (
                  <td
                    key={day.date}
                    aria-label={`${label}: ${people.length ? `${people.join(', ')} away` : 'nobody away'}`}
                    className={cn('h-20 border-t border-l p-1.5 align-top first:border-l-0', !day.inMonth && 'bg-muted/40 text-muted-foreground')}
                  >
                    <span className={cn('inline-grid size-6 place-items-center rounded-full text-xs tabular-nums', day.date === today && 'bg-primary font-semibold text-primary-foreground')}>
                      {Number(day.date.slice(8))}
                    </span>
                    <ul className="mt-1 grid gap-0.5">
                      {people.slice(0, SHOWN).map((name) => (
                        <li key={name} className="flex min-w-0 items-center gap-1 text-xs">
                          <UserAvatar name={name} className="size-4 text-[8px]" />
                          <span className="truncate">{name}</span>
                        </li>
                      ))}
                      {people.length > SHOWN ? <li className="text-xs text-muted-foreground">+{people.length - SHOWN} more</li> : null}
                    </ul>
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}
