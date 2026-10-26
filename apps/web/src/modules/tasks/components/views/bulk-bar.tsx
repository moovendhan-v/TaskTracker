import { CircleDotIcon, DownloadIcon, FlagIcon, UserIcon, XIcon } from 'lucide-react';
import type { TaskPriority, TaskStatusResponse } from '@taskflow/shared-types';
import { UserAvatar } from '@/components/common/user-avatar';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { useMembers } from '@/modules/members';
import { PRIORITY_META, PRIORITY_ORDER } from '../../lib/task-meta';
import { PriorityIcon } from '../shared/priority-picker';
import { StatusDot } from '../shared/status-picker';

interface BulkBarProps {
  workspaceId: string;
  count: number;
  statuses: readonly TaskStatusResponse[];
  onStatus: (status: TaskStatusResponse) => void;
  onPriority: (priority: TaskPriority) => void;
  onAssignee: (userId: string | null) => void;
  onExport: () => void;
  onClear: () => void;
}

const action = 'inline-flex h-8 items-center gap-1.5 rounded-md px-2.5 text-sm hover:bg-muted [&_svg]:size-4';

/** Floats over the list while tasks are selected: change them all at once or export them. */
export function BulkBar({ workspaceId, count, statuses, onStatus, onPriority, onAssignee, onExport, onClear }: BulkBarProps) {
  const { data: members = [] } = useMembers(workspaceId);
  return (
    <div role="toolbar" aria-label="Selected tasks" className="fixed bottom-6 left-1/2 z-40 flex -translate-x-1/2 items-center gap-1 rounded-xl border bg-popover p-1.5 shadow-2xl">
      <span className="flex items-center gap-2 px-2 text-sm font-medium">
        <span className="flex size-6 items-center justify-center rounded-md bg-primary text-xs text-primary-foreground tabular-nums">{count}</span> selected
      </span>
      <span className="mx-1 h-5 w-px bg-border" />
      <DropdownMenu>
        <DropdownMenuTrigger className={action}>
          <CircleDotIcon /> Status
        </DropdownMenuTrigger>
        <DropdownMenuContent side="top">
          {statuses.map((status) => (
            <DropdownMenuItem key={status.id} onSelect={() => onStatus(status)}>
              <StatusDot status={status} /> {status.name}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
      <DropdownMenu>
        <DropdownMenuTrigger className={action}>
          <FlagIcon /> Priority
        </DropdownMenuTrigger>
        <DropdownMenuContent side="top">
          {PRIORITY_ORDER.map((priority) => (
            <DropdownMenuItem key={priority} onSelect={() => onPriority(priority)}>
              <PriorityIcon priority={priority} /> {PRIORITY_META[priority].label}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
      <DropdownMenu>
        <DropdownMenuTrigger className={action}>
          <UserIcon /> Assignee
        </DropdownMenuTrigger>
        <DropdownMenuContent side="top" className="max-h-72 overflow-y-auto">
          {members.map((member) => (
            <DropdownMenuItem key={member.userId} onSelect={() => onAssignee(member.userId)}>
              <UserAvatar name={member.name} className="size-5" /> {member.name}
            </DropdownMenuItem>
          ))}
          <DropdownMenuItem onSelect={() => onAssignee(null)}>Unassign</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <button type="button" className={action} onClick={onExport}>
        <DownloadIcon /> Export
      </button>
      <span className="mx-1 h-5 w-px bg-border" />
      <button type="button" className="rounded-md p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground" aria-label="Clear selection" onClick={onClear}>
        <XIcon className="size-4" />
      </button>
    </div>
  );
}
