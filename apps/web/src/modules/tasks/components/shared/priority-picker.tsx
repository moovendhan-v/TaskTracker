import { FlagIcon } from 'lucide-react';
import type { TaskPriority } from '@taskflow/shared-types';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/cn';
import { PRIORITY_META, PRIORITY_ORDER } from '../../lib/task-meta';

export function PriorityIcon({ priority, className }: { priority: TaskPriority; className?: string }) {
  return <FlagIcon aria-hidden className={cn('size-4', PRIORITY_META[priority].text, priority !== 'none' && 'fill-current', className)} />;
}

interface PriorityPickerProps {
  value: TaskPriority;
  onChange: (priority: TaskPriority) => void;
  disabled?: boolean;
  showLabel?: boolean;
}

export function PriorityPicker({ value, onChange, disabled, showLabel = false }: PriorityPickerProps) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        disabled={disabled}
        className="inline-flex items-center gap-1.5 rounded-md px-1.5 py-1 text-sm hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none disabled:pointer-events-none"
        aria-label={`Priority: ${PRIORITY_META[value].label}`}
      >
        <PriorityIcon priority={value} />
        {showLabel ? PRIORITY_META[value].label : null}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start">
        {PRIORITY_ORDER.map((priority) => (
          <DropdownMenuItem key={priority} onSelect={() => onChange(priority)}>
            <PriorityIcon priority={priority} />
            {PRIORITY_META[priority].label}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
