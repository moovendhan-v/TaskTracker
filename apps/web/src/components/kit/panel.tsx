import type { ReactNode } from 'react';
import { cn } from '@/lib/cn';

interface PanelProps {
  title: ReactNode;
  /** Right side of the header: a hint, a filter or actions. */
  aside?: ReactNode;
  children: ReactNode;
  className?: string;
  bodyClassName?: string;
  /** Caps the body height and scrolls inside it. */
  maxBodyHeight?: number;
}

/** A titled card that holds one chart, list or table on a dashboard. */
export function Panel({ title, aside, children, className, bodyClassName, maxBodyHeight }: PanelProps) {
  return (
    <section className={cn('flex min-w-0 flex-col rounded-xl border bg-card', className)}>
      <header className="flex items-center justify-between gap-3 border-b px-4 py-3">
        <h2 className="truncate text-sm font-semibold">{title}</h2>
        {aside ? <div className="shrink-0 text-xs text-muted-foreground">{aside}</div> : null}
      </header>
      <div className={cn('min-h-0 flex-1 p-4', maxBodyHeight && 'overflow-y-auto', bodyClassName)} style={maxBodyHeight ? { maxHeight: maxBodyHeight } : undefined}>
        {children}
      </div>
    </section>
  );
}
