import { ClipboardListIcon, ClockIcon, FolderIcon, ListChecksIcon, TriangleAlertIcon, CalendarClockIcon, UserXIcon } from 'lucide-react';
import type { DashboardResponse } from '@taskflow/shared-types';
import { UserAvatar } from '@/components/common/user-avatar';
import { BarList, ColumnChart, GroupedColumnChart, Legend, Sparkline, StackedBar } from '@/components/kit/charts';
import { StatCard } from '@/components/kit/stat-card';
import { Skeleton } from '@/components/ui/skeleton';
import { formatMonthDay, formatNumericDate } from '@/lib/periods';
import { formatHours, formatMinutes } from '@/modules/time';

type Dashboard = DashboardResponse;

export function KpiRow({ data, mode }: { data: Dashboard; mode: 'home' | 'project' }) {
  const { summary } = data;
  const total = summary.openTasks + summary.closedTasks;
  // Trends from data the dashboard already has: the last eight weeks, and the hours of the chosen period.
  const weeks = (key: 'created' | 'closed') => data.createdVsClosed.map((week) => ({ label: `Week of ${formatMonthDay(week.weekStart)}`, value: week[key] }));
  const hours = data.minutesPerDay.map((day) => ({ label: formatMonthDay(day.day), value: day.minutes }));
  return (
    <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
      {mode === 'home' ? <StatCard label="Projects" icon={<FolderIcon />} value={summary.projects} /> : null}
      <StatCard
        label="Open tasks"
        icon={<ListChecksIcon />}
        value={summary.openTasks}
        hint={mode === 'home' ? `${summary.closedTasks} closed` : `${total} total`}
        trend={<Sparkline points={weeks('created')} label="Tasks created per week, last 8 weeks" />}
      />
      {mode === 'project' ? (
        <StatCard
          label="Closed"
          icon={<ClipboardListIcon />}
          value={summary.closedTasks}
          hint={total ? `${Math.round((summary.closedTasks / total) * 100)}% of all` : undefined}
          trend={<Sparkline points={weeks('closed')} label="Tasks closed per week, last 8 weeks" />}
        />
      ) : null}
      <StatCard label="Overdue" icon={<TriangleAlertIcon />} value={summary.overdue} tone={summary.overdue > 0 ? 'critical' : 'default'} />
      <StatCard label="Due in 7 days" icon={<CalendarClockIcon />} value={summary.dueSoon} tone={summary.dueSoon > 0 ? 'warning' : 'default'} />
      <StatCard label={mode === 'home' ? 'Unassigned' : 'Unassigned (open)'} icon={<UserXIcon />} value={summary.unassigned} />
      <StatCard
        label="Hours logged"
        icon={<ClockIcon />}
        value={formatHours(summary.minutesLogged)}
        hint={data.hoursOnlyMine ? 'your time only' : mode === 'project' ? `${summary.entries} entries · ${formatMinutes(summary.minutesAllTime)} all-time` : 'selected people'}
        trend={<Sparkline points={hours} label="Hours logged per day in this period" formatValue={formatMinutes} />}
      />
    </div>
  );
}

/** Placeholder tiles while the numbers load, so the layout doesn't jump. */
export function KpiRowSkeleton({ tiles }: { tiles: number }) {
  return (
    <div aria-hidden className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
      {Array.from({ length: tiles }, (_, index) => (
        <div key={index} className="grid gap-2.5 rounded-xl border bg-card p-4">
          <Skeleton className="h-3.5 w-24" />
          <Skeleton className="h-7 w-14" />
        </div>
      ))}
    </div>
  );
}

export function StatusBreakdown({ data, openOnly }: { data: Dashboard; openOnly: boolean }) {
  const rows = data.byStatus.filter((row) => !openOnly || (row.category !== 'done' && row.category !== 'cancelled'));
  return <StackedBar label="Tasks by status" showPercent={openOnly} segments={rows.map((row) => ({ key: row.name, label: row.name, value: row.count, color: row.color }))} />;
}

export function PriorityPanel({ data }: { data: Dashboard }) {
  const max = Math.max(1, ...data.byPriority.map((row) => row.open));
  return (
    <div className="grid gap-3">
      <Legend
        items={[
          { key: 'ontime', label: 'On time', color: 'var(--chart-1)' },
          { key: 'late', label: 'Overdue', color: 'var(--critical)' },
        ]}
      />
      {data.byPriority.length === 0 ? <p className="py-4 text-center text-sm text-muted-foreground">No open tasks.</p> : null}
      {data.byPriority.map((row) => (
        <div key={row.priority} className="grid grid-cols-[5rem_minmax(0,1fr)_auto] items-center gap-3 text-sm">
          <span className="capitalize">{row.priority === 'none' ? 'None' : row.priority}</span>
          <span className="flex h-2.5 gap-0.5" style={{ width: `${(row.open / max) * 100}%` }} aria-label={`${row.open} open, ${row.overdue} overdue`}>
            {row.open - row.overdue > 0 ? <span className="h-full rounded-l-full bg-chart-1 last:rounded-r-full" style={{ flex: row.open - row.overdue }} /> : null}
            {row.overdue > 0 ? <span className="h-full rounded-r-full bg-critical first:rounded-l-full" style={{ flex: row.overdue }} /> : null}
          </span>
          <span className="text-xs tabular-nums text-muted-foreground">
            {row.open}
            {row.overdue ? <span className="text-critical"> · {row.overdue} late</span> : null}
          </span>
        </div>
      ))}
    </div>
  );
}

const AGING = ['1–7 days', '8–30 days', '31–90 days', '90+ days'];

export function OverdueAging({ data }: { data: Dashboard }) {
  return (
    <ColumnChart
      label="Overdue tasks by days late"
      showValues
      color="var(--critical)"
      data={data.overdueAging.map((value, index) => ({ key: AGING[index] ?? String(index), label: AGING[index] ?? '', value, tooltip: `${AGING[index]} late: ${value}` }))}
    />
  );
}

export function DueForecast({ data }: { data: Dashboard }) {
  const color = { overdue: 'var(--critical)', week: 'var(--chart-1)', later: 'var(--muted-foreground)', none: 'var(--muted-foreground)' } as const;
  return (
    <div className="grid gap-3">
      <Legend
        items={[
          { key: 'overdue', label: 'Overdue', color: color.overdue },
          { key: 'week', label: 'Due that week', color: color.week },
          { key: 'later', label: 'Later / no date', color: color.later },
        ]}
      />
      <ColumnChart
        label="Open tasks by due week"
        showValues
        data={data.dueForecast.map((bucket) => ({
          key: bucket.kind + (bucket.weekStart ?? ''),
          label: bucket.kind === 'week' && bucket.weekStart ? formatMonthDay(bucket.weekStart) : bucket.label,
          value: bucket.count,
          tooltip: `${bucket.kind === 'week' && bucket.weekStart ? `Week of ${formatMonthDay(bucket.weekStart)}` : bucket.label}: ${bucket.count}`,
          color: color[bucket.kind],
        }))}
      />
    </div>
  );
}

export function CreatedVsClosed({ data }: { data: Dashboard }) {
  const created = data.createdVsClosed.reduce((sum, week) => sum + week.created, 0);
  const closed = data.createdVsClosed.reduce((sum, week) => sum + week.closed, 0);
  const growth = created - closed;
  return (
    <GroupedColumnChart
      label="Tasks created and closed per week"
      series={[
        { key: 'created', label: 'Created', color: 'var(--chart-1)' },
        { key: 'closed', label: 'Closed', color: 'var(--chart-2)' },
      ]}
      groups={data.createdVsClosed.map((week) => ({ key: week.weekStart, label: formatMonthDay(week.weekStart), values: [week.created, week.closed] }))}
      note={growth === 0 ? 'Backlog held steady' : growth > 0 ? <span className="text-warning">Backlog grew by {growth} in 8 weeks</span> : <span className="text-good">Backlog shrank by {-growth} in 8 weeks</span>}
    />
  );
}

export function HoursPerDay({ data, height = 160 }: { data: Dashboard; height?: number }) {
  const days = data.minutesPerDay;
  return (
    <ColumnChart
      label="Hours logged per day"
      height={height}
      axis={days.length > 10 ? 'ends' : 'all'}
      color="var(--primary)"
      reference={{ value: 8, label: '8 h' }}
      data={days.map((day) => ({
        key: day.day,
        label: days.length > 10 ? formatNumericDate(day.day) : formatMonthDay(day.day),
        value: day.minutes / 60,
        tooltip: `${formatMonthDay(day.day)}: ${formatMinutes(day.minutes)}`,
      }))}
    />
  );
}

export function HoursByPerson({ data }: { data: Dashboard }) {
  return <BarList label="Hours by person" rows={data.minutesByPerson.map((row) => ({ key: row.userId, label: row.name, value: row.minutes, display: formatMinutes(row.minutes) }))} empty="No time logged." />;
}

export function HoursByProject({ data }: { data: Dashboard }) {
  return <BarList label="Hours by project" color="var(--primary)" rows={data.minutesByProject.map((row) => ({ key: row.spaceId ?? 'none', label: row.name, value: row.minutes, display: formatMinutes(row.minutes) }))} empty="No time logged." />;
}

export function HoursByTask({ data }: { data: Dashboard }) {
  return <BarList label="Where the time went" color="var(--primary)" rows={data.minutesByTask.map((row) => ({ key: row.taskId, label: row.title, value: row.minutes, display: formatMinutes(row.minutes) }))} empty="No time logged." />;
}

export function Workload({ data }: { data: Dashboard }) {
  return (
    <table className="w-full text-sm">
      <thead>
        <tr className="text-left text-[11px] font-medium tracking-wide text-muted-foreground uppercase">
          <th className="pb-2 font-medium">Person</th>
          <th className="pb-2 text-right font-medium">Open</th>
          <th className="pb-2 text-right font-medium">Overdue</th>
          <th className="pb-2 text-right font-medium">Hours</th>
        </tr>
      </thead>
      <tbody>
        {data.people.map((person) => (
          <tr key={person.userId ?? 'unassigned'}>
            <td className="py-1.5">
              <span className="flex items-center gap-2">
                {person.userId ? <UserAvatar name={person.name} className="size-6" /> : <UserXIcon className="size-5 text-muted-foreground" />}
                <span className="truncate">{person.name}</span>
              </span>
            </td>
            <td className="text-right tabular-nums">{person.open}</td>
            <td className={person.overdue ? 'text-right text-critical tabular-nums' : 'text-right text-muted-foreground tabular-nums'}>{person.overdue}</td>
            <td className="text-right tabular-nums">{person.minutes ? formatHours(person.minutes) : '–'}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

