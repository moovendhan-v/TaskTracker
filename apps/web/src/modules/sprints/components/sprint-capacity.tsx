import type { SprintResponse, TaskResponse } from '@taskflow/shared-types';
import { PalmtreeIcon } from 'lucide-react';
import { UserAvatar } from '@/components/common/user-avatar';
import { cn } from '@/lib/cn';
import { useMemberName } from '@/modules/members';
import { useSprintAvailability } from '../hooks/use-sprints';
import { capacityByPerson, FOCUS_HOURS_PER_DAY } from '../lib/capacity';

const hours = (value: number) => (Number.isInteger(value) ? `${value}` : value.toFixed(1));

/**
 * Per-person capacity for a sprint (v2 Features #15a): planned estimate hours against the
 * time they have, after approved leave. Leave is only fetched for people who plan sprints;
 * others see the planned work without the leave adjustment.
 */
export function SprintCapacity({ workspaceId, sprint, tasks, canSeeLeave }: { workspaceId: string; sprint: SprintResponse; tasks: readonly TaskResponse[]; canSeeLeave: boolean }) {
  const nameOf = useMemberName(workspaceId);
  const availability = useSprintAvailability(workspaceId, sprint, canSeeLeave);
  const rows = capacityByPerson(sprint, tasks, availability.data ?? []);
  if (rows.length === 0) return null;

  return (
    <div className="grid gap-2 border-b bg-muted/20 px-4 py-3">
      <p className="flex items-center gap-2 font-mono text-[10.5px] font-semibold tracking-[0.06em] text-subtle-foreground uppercase">
        Capacity
        <span className="font-sans text-[11px] font-normal tracking-normal normal-case">
          estimates vs {FOCUS_HOURS_PER_DAY} h a working day{canSeeLeave ? ', minus approved leave' : ''}
        </span>
      </p>
      <ul className="grid gap-1.5">
        {rows.map((row) => {
          const name = nameOf(row.userId) ?? 'Member';
          const percent = row.load === null ? 100 : Math.min(100, Math.round(row.load * 100));
          const full = row.load === null || row.load >= 1;
          return (
            <li key={row.userId} className="grid grid-cols-[minmax(0,9rem)_minmax(0,1fr)_auto] items-center gap-3 text-xs">
              <span className="flex min-w-0 items-center gap-2">
                <UserAvatar name={name} className="size-5 text-[9px]" />
                <span className="truncate text-[13px]">{name.split(' ')[0]}</span>
              </span>
              <span
                role="meter"
                aria-label={`${name}: ${hours(row.plannedHours)} of ${row.availableHours} hours planned`}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={percent}
                className="h-1.5 overflow-hidden rounded-full bg-muted"
              >
                <span className={cn('block h-full rounded-full', full ? 'bg-warning' : 'bg-ring')} style={{ width: `${percent}%` }} />
              </span>
              <span className="flex items-center gap-2 whitespace-nowrap">
                {row.leaveDays ? (
                  <span className="flex items-center gap-1 rounded-full bg-warning/15 px-1.5 py-0.5 text-[11px] text-warning">
                    <PalmtreeIcon aria-hidden className="size-3" /> leave {row.leaveDays}d
                  </span>
                ) : null}
                <span className={cn('font-mono', full ? 'text-warning' : 'text-muted-foreground')}>
                  {hours(row.plannedHours)}/{row.availableHours} h
                </span>
                {row.unestimated ? <span className="text-subtle-foreground">+{row.unestimated} unestimated</span> : null}
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
