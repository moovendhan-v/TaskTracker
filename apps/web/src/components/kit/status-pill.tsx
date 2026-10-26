import { CircleIcon } from 'lucide-react';
import { cn } from '@/lib/cn';

interface StatusPillProps {
  status: { name: string; color: string };
  size?: 'sm' | 'md';
  className?: string;
}

/**
 * A status as a tinted pill. The colour is the space's own (validated by the
 * API as a hex value); the text stays in the text colour so it reads in both
 * themes whatever colour was picked.
 */
export function StatusPill({ status, size = 'sm', className }: StatusPillProps) {
  return (
    <span
      className={cn(
        'inline-flex max-w-full items-center gap-1.5 rounded-md border font-semibold tracking-wide whitespace-nowrap text-foreground uppercase',
        size === 'sm' ? 'h-6 px-2 text-[11px]' : 'h-7 px-2.5 text-xs',
        className,
      )}
      style={{ backgroundColor: `color-mix(in oklab, ${status.color} 26%, transparent)`, borderColor: `color-mix(in oklab, ${status.color} 55%, transparent)` }}
    >
      <CircleIcon className="size-2.5 shrink-0" style={{ color: status.color }} strokeWidth={3} />
      <span className="truncate">{status.name}</span>
    </span>
  );
}
