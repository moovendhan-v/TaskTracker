import { Link } from '@tanstack/react-router';
import { ChevronRightIcon, FilePlusIcon, FileTextIcon, FolderIcon, FolderOpenIcon, FolderPlusIcon, LayersIcon, MoreHorizontalIcon, PencilIcon, PlusIcon, SmileIcon, TrashIcon } from 'lucide-react';
import { useState, type DragEvent } from 'react';
import { DOC_TITLE_MAX, type DocKind, type DocumentSummaryResponse, type IconKey } from '@taskflow/shared-types';
import { ConfirmDialog } from '@/components/common/confirm-dialog';
import { EntityIcon } from '@/components/common/entity-icon';
import { IconGrid } from '@/components/common/icon-picker';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/cn';
import type { DocumentNode } from '../lib/build-tree';
import { placementFor, zoneAt, type DropZone, type Placement } from '../lib/drop-target';

const DRAG_TYPE = 'application/x-taskflow-doc';

interface DocTreeProps {
  workspaceId: string;
  nodes: DocumentNode[];
  /** The flat list the tree was built from, for working out where a drop lands. */
  documents: readonly DocumentSummaryResponse[];
  activeId: string | undefined;
  /** Ids to keep expanded so the open page is visible. */
  expandedPath: string[];
  canCreate: boolean;
  canEdit: (node: DocumentSummaryResponse) => boolean;
  onAdd: (parentId: string | null, kind: DocKind) => void;
  onRename: (node: DocumentNode, title: string) => void;
  onMove: (documentId: string, placement: Placement) => void;
  onDelete: (node: DocumentNode) => Promise<unknown>;
  onSetIcon: (node: DocumentNode, icon: IconKey | null) => void;
  /** Projects a top-level page can belong to. */
  spaces: readonly { id: string; name: string }[];
  onSetSpace: (node: DocumentNode, spaceId: string | null) => void;
}

interface DragState {
  draggedId: string | null;
  setDraggedId: (id: string | null) => void;
}

/**
 * The page tree: folders and pages, nested. Drag a row onto a folder (or page)
 * to move it inside, or onto the top or bottom edge of a row to place it
 * before or after; drop below the tree to move it to the top level.
 */
export function DocTree(props: DocTreeProps) {
  const [draggedId, setDraggedId] = useState<string | null>(null);
  const [overRoot, setOverRoot] = useState(false);
  const rootPlacement = draggedId ? placementFor(props.documents, draggedId, null, 'after') : null;

  return (
    <div className="flex min-h-full flex-col">
      <ul role="tree" aria-label="Pages" className="grid gap-px">
        {props.nodes.map((node) => (
          <DocTreeItem key={node.id} node={node} depth={0} draggedId={draggedId} setDraggedId={setDraggedId} {...props} />
        ))}
      </ul>
      <div
        aria-hidden={!draggedId}
        onDragOver={(event) => {
          if (!rootPlacement) return;
          event.preventDefault();
          setOverRoot(true);
        }}
        onDragLeave={() => setOverRoot(false)}
        onDrop={(event) => {
          event.preventDefault();
          setOverRoot(false);
          if (draggedId && rootPlacement) props.onMove(draggedId, rootPlacement);
          setDraggedId(null);
        }}
        className={cn(
          'mt-1 min-h-10 flex-1 rounded-md border border-dashed border-transparent text-center text-xs text-muted-foreground transition-colors',
          draggedId && 'border-border pt-3',
          overRoot && 'border-primary bg-primary/10 text-primary',
        )}
      >
        {draggedId ? 'Drop here to move to the top level' : null}
      </div>
    </div>
  );
}

function DocTreeItem({ node, depth, draggedId, setDraggedId, ...props }: DocTreeProps & DragState & { node: DocumentNode; depth: number }) {
  const { workspaceId, documents, activeId, expandedPath, canCreate, canEdit, onAdd, onRename, onMove, onDelete, onSetIcon, spaces, onSetSpace } = props;
  const inActivePath = expandedPath.includes(node.id);
  const [expanded, setExpanded] = useState(inActivePath);
  const [wasInActivePath, setWasInActivePath] = useState(inActivePath);
  const [renaming, setRenaming] = useState(false);
  const [zone, setZone] = useState<DropZone | null>(null);
  const isFolder = node.kind === 'folder';
  const hasChildren = node.children.length > 0;
  const active = node.id === activeId;
  const editable = canEdit(node);

  // When the active page moves under this node, expand it. Adjusted during render, not in an effect.
  if (inActivePath !== wasInActivePath) {
    setWasInActivePath(inActivePath);
    if (inActivePath) setExpanded(true);
  }

  const dropAt = (event: DragEvent<HTMLDivElement>): Placement | null => {
    if (!draggedId) return null;
    const rect = event.currentTarget.getBoundingClientRect();
    const at = zoneAt(event.clientY - rect.top, rect.height);
    const placement = placementFor(documents, draggedId, node.id, at);
    setZone(placement ? at : null);
    return placement;
  };

  const add = (kind: DocKind) => {
    setExpanded(true);
    onAdd(node.id, kind);
  };

  const Icon = isFolder ? (expanded ? FolderOpenIcon : FolderIcon) : FileTextIcon;
  const label = (
    <>
      {node.icon ? <EntityIcon icon={node.icon} className={isFolder ? 'text-primary' : 'text-muted-foreground'} /> : <Icon className={cn('size-4 shrink-0', isFolder ? 'text-primary' : 'text-muted-foreground')} />}
      {renaming ? (
        <input
          autoFocus
          defaultValue={node.title}
          maxLength={DOC_TITLE_MAX}
          aria-label={`Rename ${node.title}`}
          onClick={(event) => event.preventDefault()}
          onBlur={(event) => {
            setRenaming(false);
            const title = event.target.value.trim();
            if (title && title !== node.title) onRename(node, title);
          }}
          onKeyDown={(event) => {
            if (event.key === 'Enter') event.currentTarget.blur();
            if (event.key === 'Escape') {
              event.currentTarget.value = node.title;
              event.currentTarget.blur();
            }
          }}
          className="h-6 min-w-0 flex-1 rounded border bg-background px-1 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
        />
      ) : (
        <span className="truncate">{node.title}</span>
      )}
      {isFolder && hasChildren && !renaming ? <span className="ml-auto pr-1 text-[11px] text-muted-foreground tabular-nums">{node.children.length}</span> : null}
    </>
  );

  return (
    <li role="treeitem" aria-expanded={hasChildren || isFolder ? expanded : undefined} aria-selected={active}>
      <div
        draggable={editable && !renaming}
        onDragStart={(event) => {
          event.dataTransfer.effectAllowed = 'move';
          event.dataTransfer.setData(DRAG_TYPE, node.id);
          setDraggedId(node.id);
        }}
        onDragEnd={() => {
          setDraggedId(null);
          setZone(null);
        }}
        onDragOver={(event) => {
          if (dropAt(event)) event.preventDefault();
        }}
        onDragLeave={() => setZone(null)}
        onDrop={(event) => {
          event.preventDefault();
          const placement = dropAt(event);
          setZone(null);
          if (draggedId && placement) {
            if (zone === 'inside') setExpanded(true);
            onMove(draggedId, placement);
          }
          setDraggedId(null);
        }}
        className={cn(
          'group relative flex items-center gap-1 rounded-md pr-1 text-sm hover:bg-muted',
          active && 'bg-accent text-accent-foreground',
          draggedId === node.id && 'opacity-40',
          zone === 'inside' && 'bg-primary/15 ring-1 ring-primary',
          zone === 'before' && 'before:absolute before:inset-x-1 before:-top-px before:h-0.5 before:rounded before:bg-primary',
          zone === 'after' && 'after:absolute after:inset-x-1 after:-bottom-px after:h-0.5 after:rounded after:bg-primary',
        )}
        style={{ paddingLeft: `${depth * 14 + 4}px` }}
      >
        <button
          type="button"
          onClick={() => setExpanded((value) => !value)}
          className={cn('rounded p-0.5 text-muted-foreground hover:bg-background', !hasChildren && 'invisible')}
          aria-label={expanded ? `Collapse ${node.title}` : `Expand ${node.title}`}
          tabIndex={hasChildren ? 0 : -1}
        >
          <ChevronRightIcon className={cn('size-3.5 transition-transform', expanded && 'rotate-90')} />
        </button>
        <Link
          to="/w/$workspaceId/docs/$documentId"
          params={{ workspaceId, documentId: node.id }}
          onClick={() => isFolder && setExpanded(true)}
          onDoubleClick={() => editable && setRenaming(true)}
          draggable={false}
          className="flex min-w-0 flex-1 items-center gap-1.5 py-1.5"
        >
          {label}
        </Link>
        {canCreate && !renaming ? (
          <DropdownMenu>
            <DropdownMenuTrigger
              className="rounded p-0.5 text-muted-foreground opacity-0 transition hover:bg-background group-hover:opacity-100 focus-visible:opacity-100 data-[state=open]:opacity-100"
              aria-label={`Add inside ${node.title}`}
            >
              <PlusIcon className="size-3.5" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start">
              <DropdownMenuItem onSelect={() => add('page')}>
                <FilePlusIcon /> New page
              </DropdownMenuItem>
              {isFolder ? (
                <DropdownMenuItem onSelect={() => add('folder')}>
                  <FolderPlusIcon /> New folder
                </DropdownMenuItem>
              ) : null}
            </DropdownMenuContent>
          </DropdownMenu>
        ) : null}
        {editable ? (
          <DropdownMenu>
            <DropdownMenuTrigger
              className="rounded p-0.5 text-muted-foreground opacity-0 transition hover:bg-background group-hover:opacity-100 focus-visible:opacity-100 data-[state=open]:opacity-100"
              aria-label={`${node.title} options`}
            >
              <MoreHorizontalIcon className="size-3.5" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start">
              <DropdownMenuItem onSelect={() => setRenaming(true)}>
                <PencilIcon /> Rename
              </DropdownMenuItem>
              <DropdownMenuSub>
                <DropdownMenuSubTrigger>
                  <SmileIcon /> Icon
                </DropdownMenuSubTrigger>
                <DropdownMenuSubContent className="w-72 p-2">
                  <IconGrid value={{ icon: node.icon, color: null }} withColor={false} onChange={(next) => onSetIcon(node, next.icon)} />
                </DropdownMenuSubContent>
              </DropdownMenuSub>
              {!node.parentId && spaces.length > 0 ? (
                <DropdownMenuSub>
                  <DropdownMenuSubTrigger>
                    <LayersIcon /> Project
                  </DropdownMenuSubTrigger>
                  <DropdownMenuSubContent>
                    <DropdownMenuItem disabled={node.spaceId === null} onSelect={() => onSetSpace(node, null)}>
                      No project
                    </DropdownMenuItem>
                    {spaces.map((space) => (
                      <DropdownMenuItem key={space.id} disabled={node.spaceId === space.id} onSelect={() => onSetSpace(node, space.id)}>
                        {space.name}
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuSubContent>
                </DropdownMenuSub>
              ) : null}
              {node.parentId ? (
                <DropdownMenuItem onSelect={() => onMove(node.id, placementFor(documents, node.id, null, 'after') ?? { parentId: null, position: 0 })}>
                  <FolderIcon /> Move to top level
                </DropdownMenuItem>
              ) : null}
              <DropdownMenuSeparator />
              <ConfirmDialog
                trigger={
                  <DropdownMenuItem variant="destructive" onSelect={(event) => event.preventDefault()}>
                    <TrashIcon /> Delete
                  </DropdownMenuItem>
                }
                title={`Delete ${node.title}?`}
                description={hasChildren ? `Everything inside this ${isFolder ? 'folder' : 'page'} will be deleted too.` : `This ${isFolder ? 'folder' : 'page'} will be deleted.`}
                confirmLabel={isFolder ? 'Delete folder' : 'Delete page'}
                onConfirm={() => onDelete(node)}
              />
            </DropdownMenuContent>
          </DropdownMenu>
        ) : null}
      </div>
      {hasChildren && expanded ? (
        <ul role="group" className="grid gap-px">
          {node.children.map((child) => (
            <DocTreeItem key={child.id} node={child} depth={depth + 1} draggedId={draggedId} setDraggedId={setDraggedId} {...props} />
          ))}
        </ul>
      ) : null}
    </li>
  );
}
