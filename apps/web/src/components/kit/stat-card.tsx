import type { ReactNode } from 'react';
import { cn } from '@/lib/cn';

interface StatCardProps {
  label: string;
  value: ReactNode;
  icon?: ReactNode;
  /** A short line under the value, e.g. "43 closed". */
  hint?: ReactNode;
  /** Colours the value for states that need attention; the label says what the state is. */
  tone?: 'default' | 'critical' | 'warning' | 'good' | 'accent';
  /** A sparkline (or other small trend) under the number. */
  trend?: ReactNode;
  className?: string;
}

const TONE = {
  default: 'text-foreground',
  critical: 'text-critical',
  warning: 'text-warning',
  good: 'text-good',
  accent: 'text-primary',
} as const;

/** One headline number with its label: open tasks, overdue, hours logged. */
export function StatCard({ label, value, icon, hint, tone = 'default', trend, className }: StatCardProps) {
  return (
    <section className={cn('flex min-w-0 flex-col gap-1 rounded-xl border bg-card p-4', className)} aria-label={label}>
      <h3 className="flex items-center gap-2 text-sm text-muted-foreground [&_svg]:size-4">
        {icon}
        {label}
      </h3>
      <p className={cn('truncate text-[clamp(1.5rem,2.1vw,1.875rem)] font-semibold whitespace-nowrap tabular-nums tracking-tight', TONE[tone])}>{value}</p>
      {hint ? <p className="text-xs text-muted-foreground">{hint}</p> : null}
      {trend}
    </section>
  );
}
