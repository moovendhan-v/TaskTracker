import { cn } from '@/lib/cn';
import { useRealtimeStatus } from './realtime-status.store';

const LABELS = { live: 'Live', connecting: 'Connecting…', offline: 'Offline, reconnecting' } as const;

/** A small dot showing whether live updates are flowing. */
export function RealtimeIndicator() {
  const status = useRealtimeStatus((state) => state.status);
  return (
    <span role="status" className="flex items-center gap-1.5 text-xs text-muted-foreground" title="Changes from your team appear without reloading">
      <span
        aria-hidden
        className={cn('size-2 rounded-full', status === 'live' ? 'bg-status-done' : status === 'connecting' ? 'bg-status-in-review' : 'bg-destructive')}
      />
      {LABELS[status]}
    </span>
  );
}
