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
import { cn } from '@/lib/cn';
import { useWorkspaces } from '../hooks/use-workspaces';
import { CreateWorkspaceDialog } from './create-workspace-dialog';

/** `sidebar`: full row with role; `chip`: compact button for the top bar. */
export function WorkspaceSwitcher({ workspaceId, variant = 'sidebar' }: { workspaceId: string; variant?: 'sidebar' | 'chip' }) {
  const navigate = useNavigate();
  const { data: workspaces = [] } = useWorkspaces();
  const current = workspaces.find((workspace) => workspace.id === workspaceId);

  return (
    <div className={cn('flex items-center gap-1', variant === 'sidebar' && 'px-3 pt-3')}>
      <DropdownMenu>
        <DropdownMenuTrigger
          aria-label={`Workspace: ${current?.name ?? ''}`}
          className={cn(
            'flex min-w-0 items-center gap-2 rounded-md text-left focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none',
            variant === 'sidebar' ? 'flex-1 px-2 py-1.5 hover:bg-sidebar-accent' : 'h-8 border bg-muted/60 px-1.5 pr-2.5 hover:bg-muted',
          )}
        >
          <span
            className={cn('flex shrink-0 items-center justify-center rounded-md text-xs font-bold text-white', variant === 'sidebar' ? 'size-7' : 'size-5 text-[11px]')}
            style={{ backgroundColor: current?.color ?? '#0f766e' }}
          >
            {current?.name.slice(0, 1).toUpperCase() ?? '·'}
          </span>
          {variant === 'sidebar' ? (
            <>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-semibold">{current?.name ?? 'Workspace'}</span>
                <span className="block truncate text-xs text-sidebar-muted">{current?.roleName}</span>
              </span>
              <ChevronsUpDownIcon className="size-4 text-sidebar-muted" />
            </>
          ) : (
            <span className="max-w-40 truncate text-sm font-semibold uppercase">{current?.name ?? 'Workspace'}</span>
          )}
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
