import type { TaskStatusResponse } from '@taskflow/shared-types';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/cn';
import { useStatuses } from '../../hooks/use-tasks';

type StatusLike = Pick<TaskStatusResponse, 'name' | 'color'>;

export function StatusDot({ status, className }: { status: StatusLike; className?: string }) {
  // The colour is a hex value the server validated, so it is safe as an inline style.
  return <span aria-hidden className={cn('inline-block size-2.5 shrink-0 rounded-full', className)} style={{ backgroundColor: status.color }} />;
}

export function StatusLabel({ status }: { status: StatusLike }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-sm">
      <StatusDot status={status} />
      {status.name}
    </span>
  );
}

interface StatusPickerProps {
  workspaceId: string;
  /** The task's current status; its space decides which statuses are offered. */
  value: TaskStatusResponse;
  onChange: (status: TaskStatusResponse) => void;
  disabled?: boolean;
  compact?: boolean;
}

export function StatusPicker({ workspaceId, value, onChange, disabled, compact = false }: StatusPickerProps) {
  const { data: statuses = [value] } = useStatuses(workspaceId, value.spaceId);
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        disabled={disabled}
        className="inline-flex items-center gap-1.5 rounded-md px-1.5 py-1 text-sm hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none disabled:pointer-events-none"
        aria-label={`Status: ${value.name}`}
      >
        <StatusDot status={value} />
        {compact ? null : value.name}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start">
        {statuses.map((status) => (
          <DropdownMenuItem key={status.id} onSelect={() => status.id !== value.id && onChange(status)}>
            <StatusDot status={status} />
            {status.name}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
