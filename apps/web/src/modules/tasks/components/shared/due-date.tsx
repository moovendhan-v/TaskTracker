import { CalendarIcon } from 'lucide-react';
import { cn } from '@/lib/cn';
import { formatShortDate, fromDateInputValue, isOverdue, toDateInputValue } from '@/lib/dates';

export function DueDateLabel({ dueDate, done }: { dueDate: string | null; done: boolean }) {
  if (!dueDate) return null;
  const overdue = !done && isOverdue(dueDate);
  return (
    <span className={cn('inline-flex items-center gap-1 text-xs text-muted-foreground', overdue && 'font-medium text-destructive')}>
      <CalendarIcon className="size-3.5" />
      {formatShortDate(dueDate)}
    </span>
  );
}

interface DueDateInputProps {
  id: string;
  value: string | null;
  onChange: (iso: string | null) => void;
  disabled?: boolean;
}

export function DueDateInput({ id, value, onChange, disabled }: DueDateInputProps) {
  return (
    <input
      id={id}
      type="date"
      disabled={disabled}
      value={toDateInputValue(value)}
      onChange={(event) => onChange(fromDateInputValue(event.target.value))}
      className="h-8 rounded-md border border-input bg-card px-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
    />
  );
}
