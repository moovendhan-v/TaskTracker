import { CUSTOM_PERIOD_DAYS_MAX, customPeriod, parseCustomPeriod } from '@taskflow/shared-types';
import { CalendarRangeIcon, RefreshCwIcon, UsersIcon, XIcon } from 'lucide-react';
import { useState } from 'react';
import { UserAvatar } from '@/components/common/user-avatar';
import { Segmented } from '@/components/kit/segmented';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/cn';
import { addDays, formatWindow, localDay, PERIOD_LABELS, periodLabel, PERIODS, periodWindow, type Period } from '@/lib/periods';
import { useMembers } from '@/modules/members';

interface DashboardFiltersProps {
  period: Period;
  onPeriod: (period: Period) => void;
  weekStart: number;
  onRefresh: () => void;
  refreshing: boolean;
  /** Shown after the dates, e.g. "hours are for this period, task counts are live". */
  note: string;
  people?: { workspaceId: string; selected: readonly string[]; onChange: (userIds: string[]) => void; meId: string | undefined };
}

/** One row of filters above the charts: the period, an optional people filter and refresh. */
export function DashboardFilters({ period, onPeriod, weekStart, onRefresh, refreshing, note, people }: DashboardFiltersProps) {
  return (
    <div className="grid gap-3">
      <div className="flex flex-wrap items-center gap-3">
        <Segmented variant="pills" size="md" label="Period" value={period} onChange={onPeriod} options={PERIODS.map((value) => ({ value, label: PERIOD_LABELS[value] }))} />
        <CustomRange period={period} weekStart={weekStart} onPeriod={onPeriod} />
        <span className="text-xs text-muted-foreground">
          {formatWindow(periodWindow(period, weekStart))} · {note}
        </span>
        <Button variant="ghost" size="icon-sm" className="ml-auto" aria-label="Refresh" onClick={onRefresh}>
          <RefreshCwIcon className={refreshing ? 'animate-spin' : undefined} />
        </Button>
      </div>
      {people ? <PeopleFilter {...people} /> : null}
    </div>
  );
}

function PeopleFilter({ workspaceId, selected, onChange, meId }: NonNullable<DashboardFiltersProps['people']>) {
  const { data: members = [] } = useMembers(workspaceId);
  const chosen = members.filter((member) => selected.includes(member.userId));
  return (
    <div className="flex flex-wrap items-center gap-2">
      <Popover>
        <PopoverTrigger asChild>
          <Button variant="outline" size="sm" className={selected.length ? 'border-primary/60 bg-primary/10' : undefined}>
            <UsersIcon /> {selected.length ? `${selected.length} ${selected.length === 1 ? 'person' : 'people'}` : 'Everyone'}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-64 p-2">
          <div className="grid max-h-72 gap-0.5 overflow-y-auto">
            {members.map((member) => (
              <label key={member.userId} className="flex items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-muted">
                <Checkbox
                  checked={selected.includes(member.userId)}
                  onCheckedChange={(checked) => onChange(checked ? [...selected, member.userId] : selected.filter((id) => id !== member.userId))}
                />
                <UserAvatar name={member.name} className="size-5" />
                <span className="truncate">{member.userId === meId ? `${member.name} (me)` : member.name}</span>
              </label>
            ))}
          </div>
        </PopoverContent>
      </Popover>
      {chosen.map((member) => (
        <span key={member.userId} className="inline-flex items-center gap-1.5 rounded-full border py-0.5 pr-1 pl-0.5 text-xs">
          <UserAvatar name={member.name} className="size-5" />
          {member.userId === meId ? 'Me' : member.name}
          <button type="button" aria-label={`Remove ${member.name}`} className="rounded-full p-0.5 hover:bg-muted" onClick={() => onChange(selected.filter((id) => id !== member.userId))}>
            <XIcon className="size-3" />
          </button>
        </span>
      ))}
    </div>
  );
}

/** Pick any range of days, both ends included; it shows as the active pill while it's in use. */
function CustomRange({ period, weekStart, onPeriod }: { period: Period; weekStart: number; onPeriod: (period: Period) => void }) {
  const active = parseCustomPeriod(period);
  const [open, setOpen] = useState(false);
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const start = (next: boolean) => {
    if (next) {
      // Opens on what's showing now, so tweaking a range starts from it.
      const window = periodWindow(period, weekStart);
      setFrom(localDay(window.from));
      setTo(localDay(addDays(window.to, -1)));
    }
    setOpen(next);
  };
  const picked = from && to ? customPeriod(from, to) : null;
  const valid = picked ? parseCustomPeriod(picked) : null;
  const problem = !from || !to ? 'Pick both days.' : to < from ? 'The range must end on or after its first day.' : !valid ? `A range can cover at most ${CUSTOM_PERIOD_DAYS_MAX} days.` : null;
  return (
    <Popover open={open} onOpenChange={start}>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" aria-pressed={Boolean(active)} className={cn('rounded-full', active && 'border-primary/60 bg-primary/10 text-foreground')}>
          <CalendarRangeIcon /> {active ? periodLabel(period) : 'Custom…'}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="grid w-72 gap-3 p-3">
        <p className="text-sm font-medium">Custom range</p>
        <div className="grid grid-cols-2 gap-2">
          <div className="grid gap-1">
            <Label htmlFor="range-from" className="text-xs">
              From
            </Label>
            <Input id="range-from" type="date" value={from} max={to || undefined} onChange={(event) => setFrom(event.target.value)} className="h-8" />
          </div>
          <div className="grid gap-1">
            <Label htmlFor="range-to" className="text-xs">
              To
            </Label>
            <Input id="range-to" type="date" value={to} min={from || undefined} onChange={(event) => setTo(event.target.value)} className="h-8" />
          </div>
        </div>
        {problem ? <p className="text-xs text-critical">{problem}</p> : <p className="text-xs text-muted-foreground">{valid!.days} {valid!.days === 1 ? 'day' : 'days'}, both ends included.</p>}
        <Button
          size="sm"
          className="justify-self-end"
          disabled={Boolean(problem)}
          onClick={() => {
            onPeriod(picked!);
            setOpen(false);
          }}
        >
          Apply
        </Button>
      </PopoverContent>
    </Popover>
  );
}
