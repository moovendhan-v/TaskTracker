import { DownloadIcon, MessageSquareTextIcon, SearchIcon } from 'lucide-react';
import { useState } from 'react';
import type { TimeEntryResponse } from '@taskflow/shared-types';
import { Section } from '@/components/kit/section';
import { Segmented } from '@/components/kit/segmented';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { useCurrentUser } from '@/core/auth/use-current-user';
import { usePreferences } from '@/core/preferences/use-preferences';
import { downloadCsv } from '@/lib/export-csv';
import { formatNumericDate, formatWindow, localDay, PERIOD_LABELS, PERIODS, periodWindow, startOfWeek, type Period } from '@/lib/periods';
import { usePermissions } from '@/modules/workspaces';
import { useTimeEntries } from '../hooks/use-time';
import { formatMinutes } from '../lib/time-format';

const GROUPS = ['task', 'day', 'week', 'person', 'activity'] as const;
type GroupKey = (typeof GROUPS)[number];

interface TimeReportProps {
  workspaceId: string;
  spaceId?: string;
  onOpenTask: (taskId: string) => void;
}

/** Logged time for a project, grouped by task, day, week, person or activity, with memos and CSV export. */
export function TimeReport({ workspaceId, spaceId, onOpenTask }: TimeReportProps) {
  const { weekStart } = usePreferences();
  const { data: me } = useCurrentUser();
  const { can } = usePermissions(workspaceId);
  const canSeeAll = can('time.view_all');
  const [period, setPeriod] = useState<Period>('this_week');
  const [who, setWho] = useState<'everyone' | 'me'>(canSeeAll ? 'everyone' : 'me');
  const [groupBy, setGroupBy] = useState<GroupKey>('task');
  const [memoOnly, setMemoOnly] = useState(false);
  const [search, setSearch] = useState('');
  const [expandAll, setExpandAll] = useState<boolean | undefined>(undefined);
  const window = periodWindow(period, weekStart);
  const entries = useTimeEntries(workspaceId, {
    from: window.from.toISOString(),
    to: window.to.toISOString(),
    ...(spaceId && { spaceId }),
    ...(who === 'me' && me && { userIds: [me.id] }),
  });

  const rows = (entries.data ?? []).filter((entry) => entry.endedAt && (!memoOnly || entry.note) && (!search || entry.note.toLowerCase().includes(search.toLowerCase())));
  const total = rows.reduce((sum, entry) => sum + entry.minutes, 0);
  const keyOf = (entry: TimeEntryResponse): [string, string] => {
    const started = new Date(entry.startedAt);
    switch (groupBy) {
      case 'task':
        return [entry.taskId ?? 'none', entry.task?.title ?? 'Without a task'];
      case 'day':
        return [localDay(started), formatNumericDate(started)];
      case 'week': {
        const week = startOfWeek(started, weekStart);
        return [localDay(week), `Week of ${formatNumericDate(week)}`];
      }
      case 'person':
        return [entry.userId, entry.userName ?? 'Former member'];
      case 'activity':
        return [entry.activity || 'none', entry.activity || 'No activity'];
    }
  };
  const groups = new Map<string, { label: string; entries: TimeEntryResponse[]; minutes: number }>();
  for (const entry of rows) {
    const [key, label] = keyOf(entry);
    const group = groups.get(key) ?? { label, entries: [], minutes: 0 };
    group.entries.push(entry);
    group.minutes += entry.minutes;
    groups.set(key, group);
  }
  const sorted = [...groups.entries()].sort(([a, x], [b, y]) => (groupBy === 'day' || groupBy === 'week' ? a.localeCompare(b) : y.minutes - x.minutes));
  const max = Math.max(1, ...sorted.map(([, group]) => group.minutes));

  const exportCsv = () =>
    downloadCsv(
      'time.csv',
      ['Date', 'Start', 'End', 'Minutes', 'Person', 'Project', 'Task number', 'Task', 'Activity', 'Memo'],
      rows.map((entry) => [
        localDay(new Date(entry.startedAt)),
        entry.startedAt,
        entry.endedAt ?? '',
        entry.minutes,
        entry.userName ?? '',
        entry.spaceName ?? '',
        entry.task?.number ?? '',
        entry.task?.title ?? '',
        entry.activity,
        entry.note,
      ]),
    );

  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap items-center gap-3">
        <Segmented variant="pills" size="md" label="Period" value={period} onChange={setPeriod} options={PERIODS.map((value) => ({ value, label: PERIOD_LABELS[value] }))} />
        {canSeeAll ? <Segmented label="Whose time" value={who} onChange={setWho} options={[{ value: 'everyone', label: 'Everyone' }, { value: 'me', label: 'Only me' }]} /> : null}
        <span className="flex-1" />
        <label className="flex items-center gap-2 text-sm">
          <Checkbox checked={memoOnly} onCheckedChange={(checked) => setMemoOnly(checked === true)} /> With memo only
        </label>
        <div className="relative">
          <SearchIcon className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-muted-foreground" />
          <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search memos" aria-label="Search memos" className="h-8 w-48 rounded-md border bg-muted/40 pr-2 pl-8 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring" />
        </div>
        <Button variant="outline" size="sm" onClick={exportCsv} disabled={rows.length === 0}>
          <DownloadIcon /> CSV
        </Button>
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <span className="text-sm text-muted-foreground">Group by</span>
        <Segmented label="Group by" value={groupBy} onChange={setGroupBy} options={GROUPS.map((value) => ({ value, label: value[0]!.toUpperCase() + value.slice(1) }))} />
        <span className="text-sm">
          <span className="font-semibold">{formatMinutes(total)}</span> in {rows.length} entries · {formatWindow(window)}
        </span>
        <button type="button" className="ml-auto text-sm text-primary hover:underline" onClick={() => setExpandAll(!expandAll)}>
          {expandAll ? 'Collapse all' : 'Expand all'}
        </button>
      </div>
      <div className="divide-y rounded-xl border bg-card">
        {sorted.map(([key, group]) => (
          <Section
            key={`${groupBy}:${key}:${String(expandAll)}`}
            defaultOpen={expandAll ?? false}
            className="px-3"
            title={<span className="truncate text-sm font-medium">{group.label}</span>}
            actions={
              <span className="flex items-center gap-4">
                <span className="hidden h-2 w-44 overflow-hidden rounded-full bg-muted sm:block">
                  <span className="block h-full rounded-full bg-primary" style={{ width: `${(group.minutes / max) * 100}%` }} />
                </span>
                <span className="w-16 text-xs text-muted-foreground">
                  {group.entries.length} {group.entries.length === 1 ? 'entry' : 'entries'}
                </span>
                <span className="w-20 text-right text-sm font-semibold tabular-nums">{formatMinutes(group.minutes)}</span>
              </span>
            }
          >
            <div className="grid gap-2 pb-3 pl-6">
              {groupBy === 'task' && key !== 'none' ? (
                <button type="button" className="w-fit text-sm text-primary hover:underline" onClick={() => onOpenTask(key)}>
                  Open task #{group.entries[0]?.task?.number}
                </button>
              ) : null}
              {group.entries.map((entry) => (
                <div key={entry.id} className="grid grid-cols-[1.25rem_minmax(0,1fr)_auto] gap-2 text-sm">
                  <MessageSquareTextIcon className="mt-0.5 size-4 text-muted-foreground" />
                  <div className="min-w-0">
                    <div className="text-xs text-muted-foreground">
                      {formatNumericDate(entry.startedAt)} · {entry.userName ?? 'Former member'}
                      {entry.activity ? ` · ${entry.activity}` : ''}
                      {groupBy !== 'task' && entry.task ? ` · #${entry.task.number} ${entry.task.title}` : ''}
                    </div>
                    <div className="whitespace-pre-wrap">{entry.note || <span className="text-muted-foreground">No memo</span>}</div>
                  </div>
                  <span className="tabular-nums">{formatMinutes(entry.minutes)}</span>
                </div>
              ))}
            </div>
          </Section>
        ))}
        {entries.data && sorted.length === 0 ? <p className="p-8 text-center text-sm text-muted-foreground">No time logged in this period.</p> : null}
      </div>
    </div>
  );
}
