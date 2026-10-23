import type { TaskStatus } from '@taskflow/shared-types';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/cn';
import { STATUS_META, STATUS_ORDER } from '../../lib/task-meta';

export function StatusDot({ status, className }: { status: TaskStatus; className?: string }) {
  return <span aria-hidden className={cn('inline-block size-2.5 shrink-0 rounded-full', STATUS_META[status].dot, className)} />;
}

export function StatusLabel({ status }: { status: TaskStatus }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-sm">
      <StatusDot status={status} />
      {STATUS_META[status].label}
    </span>
  );
}

interface StatusPickerProps {
  value: TaskStatus;
  onChange: (status: TaskStatus) => void;
  disabled?: boolean;
  compact?: boolean;
}

export function StatusPicker({ value, onChange, disabled, compact = false }: StatusPickerProps) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        disabled={disabled}
        className="inline-flex items-center gap-1.5 rounded-md px-1.5 py-1 text-sm hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none disabled:pointer-events-none"
        aria-label={`Status: ${STATUS_META[value].label}`}
      >
        <StatusDot status={value} />
        {compact ? null : STATUS_META[value].label}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start">
        {STATUS_ORDER.map((status) => (
          <DropdownMenuItem key={status} onSelect={() => onChange(status)}>
            <StatusDot status={status} />
            {STATUS_META[status].label}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
