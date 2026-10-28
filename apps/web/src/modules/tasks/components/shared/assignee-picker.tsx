import { CheckIcon, UserPlusIcon, UserXIcon } from 'lucide-react';
import { UserAvatar } from '@/components/common/user-avatar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useMembers } from '@/modules/members';

interface AssigneePickerProps {
  workspaceId: string;
  value?: string | null;
  values?: string[];
  onChange?: (userId: string | null) => void;
  onChangeMultiple?: (userIds: string[]) => void;
  disabled?: boolean;
  showName?: boolean;
}

export function AssigneePicker({
  workspaceId,
  value,
  values,
  onChange,
  onChangeMultiple,
  disabled,
  showName = false,
}: AssigneePickerProps) {
  const { data: members = [] } = useMembers(workspaceId);

  // Normalize selected IDs from values or single value
  const selectedIds: string[] = values !== undefined
    ? values.filter(Boolean)
    : value
      ? [value]
      : [];

  const assignedMembers = selectedIds
    .map((id) => members.find((m) => m.userId === id))
    .filter((m): m is NonNullable<typeof m> => !!m);

  const isMulti = !!onChangeMultiple;

  const handleToggle = (userId: string) => {
    const isSelected = selectedIds.includes(userId);
    if (onChangeMultiple) {
      const next = isSelected
        ? selectedIds.filter((id) => id !== userId)
        : [...selectedIds, userId];
      onChangeMultiple(next);
      if (onChange) onChange(next[0] ?? null);
    } else if (onChange) {
      onChange(isSelected ? null : userId);
    }
  };

  const handleClear = () => {
    if (onChangeMultiple) {
      onChangeMultiple([]);
    }
    if (onChange) {
      onChange(null);
    }
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        disabled={disabled}
        className="inline-flex items-center gap-1.5 rounded-md px-1 py-0.5 text-sm hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none disabled:pointer-events-none transition-colors"
        aria-label={
          assignedMembers.length > 0
            ? `Assigned to ${assignedMembers.map((m) => m.name).join(', ')}`
            : 'Assign'
        }
      >
        {assignedMembers.length > 1 ? (
          <>
            <div className="flex -space-x-1.5 items-center">
              {assignedMembers.slice(0, 3).map((m) => (
                <UserAvatar key={m.userId} name={m.name} className="size-6 ring-2 ring-background shrink-0" />
              ))}
              {assignedMembers.length > 3 && (
                <span className="flex size-6 items-center justify-center rounded-full bg-muted text-[10px] font-semibold ring-2 ring-background shrink-0">
                  +{assignedMembers.length - 3}
                </span>
              )}
            </div>
            {showName ? (
              <span className="text-xs font-medium">
                {assignedMembers.length} assignees
              </span>
            ) : null}
          </>
        ) : assignedMembers.length === 1 && assignedMembers[0] ? (
          <>
            <UserAvatar name={assignedMembers[0].name} className="size-6" />
            {showName ? <span className="truncate max-w-[120px]">{assignedMembers[0].name}</span> : null}
          </>
        ) : (
          <>
            <span className="flex size-6 items-center justify-center rounded-full border border-dashed text-muted-foreground">
              <UserPlusIcon className="size-3.5" />
            </span>
            {showName ? <span className="text-muted-foreground text-xs">Unassigned</span> : null}
          </>
        )}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-56 max-h-72 overflow-y-auto p-1">
        <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground">
          {isMulti ? 'Assign one or more' : 'Assign to'}
        </div>
        {members.map((member) => {
          const isSelected = selectedIds.includes(member.userId);
          return (
            <DropdownMenuItem
              key={member.userId}
              onSelect={(e) => {
                if (isMulti) {
                  e.preventDefault();
                }
                handleToggle(member.userId);
              }}
              className="flex items-center justify-between gap-2 cursor-pointer py-1.5"
            >
              <div className="flex items-center gap-2 min-w-0">
                <UserAvatar name={member.name} className="size-5 shrink-0" />
                <span className="truncate text-xs font-medium">{member.name}</span>
              </div>
              {isSelected && <CheckIcon className="size-4 text-primary shrink-0" />}
            </DropdownMenuItem>
          );
        })}
        {selectedIds.length > 0 ? (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem onSelect={handleClear} className="text-destructive focus:text-destructive py-1.5">
              <UserXIcon className="size-4 mr-2" />
              <span className="text-xs font-medium">
                {selectedIds.length > 1 ? 'Clear all assignees' : 'Unassign'}
              </span>
            </DropdownMenuItem>
          </>
        ) : null}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
