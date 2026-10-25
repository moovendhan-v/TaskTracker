import { CalendarClockIcon, PlayIcon, SquareIcon } from 'lucide-react';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { usePermissions } from '@/modules/workspaces';
import { useRunningTimer, useTaskTime, useTimeMutations } from '../hooks/use-time';
import { formatMinutes } from '../lib/time-format';
import { LogTimeDialog, type PickedTask } from './log-time-dialog';

/** Start/stop a timer on a task, log time by hand, and see how much is logged. */
export function TaskTimeControls({ workspaceId, task }: { workspaceId: string; task: PickedTask }) {
  const [logging, setLogging] = useState(false);
  const { can } = usePermissions(workspaceId);
  const { data: running } = useRunningTimer(workspaceId);
  const { data: summary } = useTaskTime(workspaceId, task.id);
  const { start, stop } = useTimeMutations(workspaceId);
  const runningHere = running?.taskId === task.id;

  return (
    <div className="flex flex-wrap items-center gap-2">
      {can('time.log') ? (
        <>
          {runningHere ? (
            <Button size="sm" variant="destructive" onClick={() => stop.mutate()} disabled={stop.isPending}>
              <SquareIcon /> Stop
            </Button>
          ) : (
            <Button size="sm" onClick={() => start.mutate({ taskId: task.id })} disabled={start.isPending}>
              <PlayIcon /> Start
            </Button>
          )}
          <Button size="sm" variant="outline" onClick={() => setLogging(true)}>
            <CalendarClockIcon /> Log time
          </Button>
        </>
      ) : null}
      <span className="text-sm text-muted-foreground">Logged {formatMinutes(summary?.totalMinutes ?? 0)}</span>
      {logging ? <LogTimeDialog workspaceId={workspaceId} open onOpenChange={setLogging} defaults={{ task }} /> : null}
    </div>
  );
}
