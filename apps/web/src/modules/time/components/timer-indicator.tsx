import { SquareIcon, TimerIcon } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useRunningTimer, useTimeMutations } from '../hooks/use-time';

function elapsed(startedAt: string, now: number): string {
  const seconds = Math.max(0, Math.floor((now - new Date(startedAt).getTime()) / 1000));
  const pad = (value: number) => String(value).padStart(2, '0');
  return `${Math.floor(seconds / 3600)}:${pad(Math.floor(seconds / 60) % 60)}:${pad(seconds % 60)}`;
}

/** The running timer in the top bar, ticking, with a stop button. Hidden when nothing runs. */
export function TimerIndicator({ workspaceId, onOpenTask }: { workspaceId: string; onOpenTask: (taskId: string) => void }) {
  const { data: running } = useRunningTimer(workspaceId);
  const { stop } = useTimeMutations(workspaceId);
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!running) return;
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [running]);
  if (!running) return null;

  return (
    <div className="flex h-8 items-center gap-1 rounded-md border border-primary/40 bg-primary/10 pr-1 pl-2 text-sm">
      <TimerIcon className="size-4 text-primary" aria-hidden />
      <button
        type="button"
        className="max-w-48 truncate hover:underline"
        onClick={() => running.taskId && onOpenTask(running.taskId)}
        aria-label={`Timer running${running.task ? ` on ${running.task.title}` : ''}`}
      >
        {running.task?.title ?? running.spaceName ?? 'Timer'}
      </button>
      <span className="font-mono text-xs tabular-nums" role="timer">
        {elapsed(running.startedAt, now)}
      </span>
      <button type="button" onClick={() => stop.mutate()} className="rounded p-1 text-critical hover:bg-critical/15" aria-label="Stop timer">
        <SquareIcon className="size-3.5 fill-current" />
      </button>
    </div>
  );
}
