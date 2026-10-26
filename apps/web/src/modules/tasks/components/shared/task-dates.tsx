import { ArrowRightIcon, CalendarIcon } from 'lucide-react';
import { cn } from '@/lib/cn';
import { isOverdue } from '@/lib/dates';
import { formatNumericDate } from '@/lib/periods';

interface TaskDatesProps {
  startDate: string | null;
  dueDate: string | null;
  closed: boolean;
  className?: string;
}

/** "10/19 → 10/23/26"; red when an open task is past its due date. */
export function TaskDates({ startDate, dueDate, closed, className }: TaskDatesProps) {
  const late = !closed && isOverdue(dueDate);
  if (!startDate && !dueDate) {
    return (
      <span className={cn('inline-flex items-center gap-1.5 text-sm text-muted-foreground', className)}>
        <CalendarIcon className="size-3.5" /> –
      </span>
    );
  }
  return (
    <span className={cn('inline-flex items-center gap-1.5 text-sm tabular-nums', late ? 'text-critical' : 'text-foreground', className)} aria-label={late ? 'Overdue' : undefined}>
      <CalendarIcon className="size-3.5 shrink-0" />
      {startDate ? formatNumericDate(startDate).slice(0, 5) : null}
      {startDate && dueDate ? <ArrowRightIcon className="size-3 shrink-0" /> : null}
      {dueDate ? formatNumericDate(dueDate) : null}
    </span>
  );
}
