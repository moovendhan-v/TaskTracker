import type { ReactNode } from 'react';
import { cn } from '@/lib/cn';

interface StatusPillProps {
  status: { name: string; color: string };
  size?: 'xs' | 'sm' | 'md';
  className?: string;
  children?: ReactNode;
}

/**
 * A status as a soft pill (v2 design): a 16% wash of the space's own colour, a dot in
 * the full colour, and the name in that colour pulled towards the text colour so it
 * stays readable on light and dark backgrounds. The colour is a hex value the API
 * validated, so it is safe in an inline style.
 */
export function StatusPill({ status, size = 'sm', className, children }: StatusPillProps) {
  return (
    <span
      className={cn(
        'inline-flex max-w-full items-center gap-1.5 rounded-full font-medium whitespace-nowrap',
        size === 'xs' && 'h-[18px] px-1.5 text-[10.5px]',
        size === 'sm' && 'h-[22px] px-2 text-[11.5px]',
        size === 'md' && 'h-6 px-2.5 text-xs',
        className,
      )}
      style={{
        backgroundColor: `color-mix(in oklab, ${status.color} 16%, transparent)`,
        color: `color-mix(in oklab, ${status.color} 62%, var(--foreground))`,
      }}
    >
      <span aria-hidden className="size-1.5 shrink-0 rounded-full" style={{ backgroundColor: status.color }} />
      <span className="truncate">{status.name}</span>
      {children}
    </span>
  );
}
