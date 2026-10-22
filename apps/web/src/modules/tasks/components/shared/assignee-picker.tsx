import { UserPlusIcon, UserXIcon } from 'lucide-react';
import { UserAvatar } from '@/components/common/user-avatar';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { useMembers } from '@/modules/members';

interface AssigneePickerProps {
  workspaceId: string;
  value: string | null;
  onChange: (userId: string | null) => void;
  disabled?: boolean;
  showName?: boolean;
}

export function AssigneePicker({ workspaceId, value, onChange, disabled, showName = false }: AssigneePickerProps) {
  const { data: members = [] } = useMembers(workspaceId);
  const assignee = members.find((member) => member.userId === value);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        disabled={disabled}
        className="inline-flex items-center gap-1.5 rounded-md px-1 py-0.5 text-sm hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none disabled:pointer-events-none"
        aria-label={assignee ? `Assigned to ${assignee.name}` : 'Assign'}
      >
        {assignee ? (
          <>
            <UserAvatar name={assignee.name} className="size-6" />
            {showName ? assignee.name : null}
          </>
        ) : (
          <>
            <span className="flex size-6 items-center justify-center rounded-full border border-dashed text-muted-foreground">
              <UserPlusIcon className="size-3.5" />
            </span>
            {showName ? <span className="text-muted-foreground">Unassigned</span> : null}
          </>
        )}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="max-h-72 overflow-y-auto">
        {members.map((member) => (
          <DropdownMenuItem key={member.userId} onSelect={() => onChange(member.userId)}>
            <UserAvatar name={member.name} className="size-5" />
            <span className="truncate">{member.name}</span>
          </DropdownMenuItem>
        ))}
        {value ? (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem onSelect={() => onChange(null)}>
              <UserXIcon /> Unassign
            </DropdownMenuItem>
          </>
        ) : null}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
