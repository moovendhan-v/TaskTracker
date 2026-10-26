import type { ReactNode } from 'react';
import { cn } from '@/lib/cn';

interface StatusPillProps {
  status: { name: string; color: string };
  size?: 'xs' | 'sm' | 'md';
  className?: string;
  children?: ReactNode;
}

/**
 * A status as a solid pill in the space's own colour (a hex value the API
 * validated) with white uppercase text and a ringed dot.
 */
export function StatusPill({ status, size = 'sm', className, children }: StatusPillProps) {
  return (
    <span
      className={cn(
        'inline-flex max-w-full items-center gap-1.5 rounded-[5px] font-semibold tracking-wide whitespace-nowrap text-white uppercase [text-shadow:0_0_1px_rgb(0_0_0/0.35)]',
        size === 'xs' && 'px-1.5 py-px text-[10px]',
        size === 'sm' && 'px-2 py-[3px] text-[11px]',
        size === 'md' && 'px-2.5 py-1 text-xs',
        className,
      )}
      style={{ backgroundColor: status.color }}
    >
      <span aria-hidden className="size-2 shrink-0 rounded-full border border-white/80" />
      <span className="truncate">{status.name}</span>
      {children}
    </span>
  );
}
