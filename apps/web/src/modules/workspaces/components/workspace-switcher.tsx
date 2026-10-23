import { useNavigate } from '@tanstack/react-router';
import { CheckIcon, ChevronsUpDownIcon, PlusIcon } from 'lucide-react';
import { ColorDot } from '@/components/common/color-dot';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useWorkspaces } from '../hooks/use-workspaces';
import { CreateWorkspaceDialog } from './create-workspace-dialog';

export function WorkspaceSwitcher({ workspaceId }: { workspaceId: string }) {
  const navigate = useNavigate();
  const { data: workspaces = [] } = useWorkspaces();
  const current = workspaces.find((workspace) => workspace.id === workspaceId);

  return (
    <div className="flex items-center gap-1 px-3 pt-3">
      <DropdownMenu>
        <DropdownMenuTrigger className="flex min-w-0 flex-1 items-center gap-2 rounded-md px-2 py-1.5 text-left hover:bg-sidebar-accent focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none">
          <span
            className="flex size-7 shrink-0 items-center justify-center rounded-md text-xs font-bold text-white"
            style={{ backgroundColor: current?.color ?? '#0f766e' }}
          >
            {current?.name.slice(0, 1).toUpperCase() ?? '·'}
          </span>
          <span className="min-w-0 flex-1">
            <span className="block truncate text-sm font-semibold">{current?.name ?? 'Workspace'}</span>
            <span className="block truncate text-xs text-sidebar-muted">{current?.roleName}</span>
          </span>
          <ChevronsUpDownIcon className="size-4 text-sidebar-muted" />
        </DropdownMenuTrigger>
        <DropdownMenuContent className="w-60">
          <DropdownMenuLabel>Workspaces</DropdownMenuLabel>
          {workspaces.map((workspace) => (
            <DropdownMenuItem
              key={workspace.id}
              onSelect={() => void navigate({ to: '/w/$workspaceId', params: { workspaceId: workspace.id } })}
            >
              <ColorDot color={workspace.color} />
              <span className="flex-1 truncate">{workspace.name}</span>
              {workspace.id === workspaceId ? <CheckIcon /> : null}
            </DropdownMenuItem>
          ))}
          <DropdownMenuSeparator />
          <CreateWorkspaceDialog
            trigger={
              <DropdownMenuItem onSelect={(event) => event.preventDefault()}>
                <PlusIcon /> New workspace
              </DropdownMenuItem>
            }
          />
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
