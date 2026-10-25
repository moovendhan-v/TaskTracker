import { CalendarRangeIcon, ChevronRightIcon, ListIcon, MoreHorizontalIcon, PencilIcon, PlusIcon, TrashIcon } from 'lucide-react';
import { useState } from 'react';
import type { SpaceResponse, TaskListResponse } from '@taskflow/shared-types';
import { ColorDot } from '@/components/common/color-dot';
import { ConfirmDialog } from '@/components/common/confirm-dialog';
import { NameDialog } from '@/components/common/name-dialog';
import { SidebarLink } from '@/components/layout/sidebar-link';
import { SidebarSection } from '@/components/layout/sidebar-section';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { toast } from '@/components/ui/sonner';
import { cn } from '@/lib/cn';
import { getErrorMessage } from '@/lib/errors';
import { useListMutations, useLists } from '@/modules/lists';
import { usePermissions } from '@/modules/workspaces';
import { useSpaceMutations, useSpaces } from '../hooks/use-spaces';

const iconButton =
  'rounded p-0.5 text-sidebar-muted opacity-0 transition hover:bg-sidebar-border hover:text-sidebar-foreground group-hover:opacity-100 focus-visible:opacity-100 data-[state=open]:opacity-100';

/** Sidebar tree of spaces and the lists inside them. */
export function SpaceTree({ workspaceId }: { workspaceId: string }) {
  const { data: spaces = [] } = useSpaces(workspaceId);
  const { data: lists = [] } = useLists(workspaceId);
  const { can } = usePermissions(workspaceId);
  const spaceMutations = useSpaceMutations(workspaceId);

  return (
    <SidebarSection
      title="Spaces"
      action={
        can('space.manage') ? (
          <NameDialog
            formName="space.create"
            trigger={
              <button type="button" className="rounded p-0.5 text-sidebar-muted hover:bg-sidebar-accent hover:text-sidebar-foreground" aria-label="New space">
                <PlusIcon className="size-4" />
              </button>
            }
            title="New space"
            description="Spaces group related lists, like a team or a client."
            submitLabel="Create space"
            placeholder="e.g. Engineering"
            withColor
            onSubmit={(values) => spaceMutations.create.mutateAsync(values).catch((error) => toast.error(getErrorMessage(error)))}
          />
        ) : null
      }
    >
      {spaces.length === 0 ? <p className="px-2 py-1 text-xs text-sidebar-muted">No spaces yet.</p> : null}
      {spaces.map((space) => (
        <SpaceNode key={space.id} workspaceId={workspaceId} space={space} lists={lists.filter((list) => list.spaceId === space.id)} />
      ))}
    </SidebarSection>
  );
}

interface SpaceNodeProps {
  workspaceId: string;
  space: SpaceResponse;
  lists: TaskListResponse[];
}

function SpaceNode({ workspaceId, space, lists }: SpaceNodeProps) {
  const [expanded, setExpanded] = useState(true);
  const { can } = usePermissions(workspaceId);
  const spaceMutations = useSpaceMutations(workspaceId);
  const listMutations = useListMutations(workspaceId);
  const onError = (error: unknown) => toast.error(getErrorMessage(error));

  return (
    <div>
      <div className="group flex items-center gap-1 rounded-md px-1 py-1 hover:bg-sidebar-accent">
        <button
          type="button"
          onClick={() => setExpanded((value) => !value)}
          className="flex min-w-0 flex-1 items-center gap-1.5 text-left text-sm"
          aria-expanded={expanded}
        >
          <ChevronRightIcon className={cn('size-3.5 shrink-0 text-sidebar-muted transition-transform', expanded && 'rotate-90')} />
          <ColorDot color={space.color} />
          <span className="truncate font-medium">{space.name}</span>
        </button>
        {can('list.manage') ? (
          <NameDialog
            formName="list.save"
            trigger={
              <button type="button" className={iconButton} aria-label={`New list in ${space.name}`}>
                <PlusIcon className="size-3.5" />
              </button>
            }
            title={`New list in ${space.name}`}
            submitLabel="Create list"
            placeholder="e.g. Sprint backlog"
            onSubmit={(values) => listMutations.create.mutateAsync({ spaceId: space.id, body: { name: values.name } }).catch(onError)}
          />
        ) : null}
        {can('space.manage') ? (
          <DropdownMenu>
            <DropdownMenuTrigger className={iconButton} aria-label={`${space.name} options`}>
              <MoreHorizontalIcon className="size-3.5" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start">
              <NameDialog
                formName="space.update"
                trigger={
                  <DropdownMenuItem onSelect={(event) => event.preventDefault()}>
                    <PencilIcon /> Rename
                  </DropdownMenuItem>
                }
                title="Edit space"
                submitLabel="Save"
                withColor
                defaultValues={{ name: space.name, color: space.color }}
                onSubmit={(values) => spaceMutations.update.mutateAsync({ spaceId: space.id, body: values }).catch(onError)}
              />
              <DropdownMenuSeparator />
              <ConfirmDialog
                trigger={
                  <DropdownMenuItem variant="destructive" onSelect={(event) => event.preventDefault()}>
                    <TrashIcon /> Delete
                  </DropdownMenuItem>
                }
                title={`Delete ${space.name}?`}
                description="All lists and tasks in this space will be deleted."
                confirmLabel="Delete space"
                onConfirm={() => spaceMutations.remove.mutateAsync(space.id).catch(onError)}
              />
            </DropdownMenuContent>
          </DropdownMenu>
        ) : null}
      </div>
      {expanded ? (
        <div className="ml-4 grid gap-0.5 border-l border-sidebar-border pl-2">
          <SidebarLink to="/w/$workspaceId/s/$spaceId/sprints" params={{ workspaceId, spaceId: space.id }} icon={<CalendarRangeIcon />}>
            Sprints
          </SidebarLink>
          {lists.map((list) => (
            <SidebarLink key={list.id} to="/w/$workspaceId/l/$listId" params={{ workspaceId, listId: list.id }} icon={<ListIcon />}>
              {list.name}
            </SidebarLink>
          ))}
          {lists.length === 0 ? <p className="px-2 py-1 text-xs text-sidebar-muted">No lists</p> : null}
        </div>
      ) : null}
    </div>
  );
}
