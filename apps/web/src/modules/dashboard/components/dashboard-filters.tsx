import { RefreshCwIcon, UsersIcon, XIcon } from 'lucide-react';
import { UserAvatar } from '@/components/common/user-avatar';
import { Segmented } from '@/components/kit/segmented';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { formatWindow, PERIOD_LABELS, PERIODS, periodWindow, type Period } from '@/lib/periods';
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
