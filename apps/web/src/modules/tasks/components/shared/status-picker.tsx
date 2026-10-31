import type { TaskStatusResponse } from '@taskflow/shared-types';
import { useState } from 'react';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { StatusPill } from '@/components/kit/status-pill';
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
  /** `dot`: a coloured dot (plus the name unless compact); `pill`: the status pill; `ring`: a small ring in the status colour. */
  variant?: 'dot' | 'pill' | 'ring';
  compact?: boolean;
}

export function StatusPicker({ workspaceId, value, onChange, disabled, variant = 'dot', compact = false }: StatusPickerProps) {
  const { data: statuses = [value] } = useStatuses(workspaceId, value.spaceId);
  const [open, setOpen] = useState(false);
  const choose = (status: TaskStatusResponse) => {
    setOpen(false);
    if (status.id !== value.id) onChange(status);
  };
  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger
        disabled={disabled}
        className={cn(
          'inline-flex items-center gap-1.5 rounded-md text-sm hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none disabled:pointer-events-none',
          variant === 'pill' ? 'p-0.5' : 'px-1.5 py-1',
        )}
        aria-label={`Status: ${value.name}`}
      >
        {variant === 'pill' ? (
          <StatusPill status={value} />
        ) : variant === 'ring' ? (
          <span aria-hidden className="size-3 shrink-0 rounded-full border-2" style={{ borderColor: value.color }} />
        ) : (
          <>
            <StatusDot status={value} />
            {compact ? null : value.name}
          </>
        )}
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="start"
        className="w-52"
        // 1–9 pick the matching status straight away (v2 spec: number-key shortcuts).
        onKeyDown={(event) => {
          const index = Number(event.key) - 1;
          const status = Number.isInteger(index) && index >= 0 ? statuses[index] : undefined;
          if (!status || event.metaKey || event.ctrlKey || event.altKey) return;
          event.preventDefault();
          choose(status);
        }}
      >
        <DropdownMenuLabel>Change status</DropdownMenuLabel>
        {statuses.map((status, index) => (
          <DropdownMenuItem key={status.id} onSelect={() => choose(status)} className={cn(status.id === value.id && 'bg-selected')}>
            <StatusDot status={status} className="size-2" />
            {status.name}
            {index < 9 ? <span className="ml-auto font-mono text-[10.5px] text-subtle-foreground">{index + 1}</span> : null}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
