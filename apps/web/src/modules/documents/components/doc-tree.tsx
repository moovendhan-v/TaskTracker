import { Link } from '@tanstack/react-router';
import { ChevronRightIcon, FileTextIcon, MoreHorizontalIcon, PlusIcon, TrashIcon } from 'lucide-react';
import { useEffect, useState } from 'react';
import { ConfirmDialog } from '@/components/common/confirm-dialog';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/cn';
import type { DocumentNode } from '../lib/build-tree';

interface DocTreeProps {
  workspaceId: string;
  nodes: DocumentNode[];
  activeId: string | undefined;
  /** Ids to keep expanded so the open page is visible. */
  expandedPath: string[];
  canCreate: boolean;
  canEdit: (node: DocumentNode) => boolean;
  onAddChild: (parentId: string) => void;
  onDelete: (node: DocumentNode) => Promise<unknown>;
}

export function DocTree(props: DocTreeProps) {
  return (
    <ul role="tree" aria-label="Pages" className="grid gap-0.5">
      {props.nodes.map((node) => (
        <DocTreeItem key={node.id} node={node} depth={0} {...props} />
      ))}
    </ul>
  );
}

function DocTreeItem({ node, depth, ...props }: DocTreeProps & { node: DocumentNode; depth: number }) {
  const { workspaceId, activeId, expandedPath, canCreate, canEdit, onAddChild, onDelete } = props;
  const [expanded, setExpanded] = useState(expandedPath.includes(node.id));
  const hasChildren = node.children.length > 0;
  const active = node.id === activeId;

  useEffect(() => {
    if (expandedPath.includes(node.id)) setExpanded(true);
  }, [expandedPath, node.id]);

  return (
    <li role="treeitem" aria-expanded={hasChildren ? expanded : undefined} aria-selected={active}>
      <div
        className={cn('group flex items-center gap-1 rounded-md pr-1 text-sm hover:bg-muted', active && 'bg-accent text-accent-foreground')}
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
          className="flex min-w-0 flex-1 items-center gap-1.5 py-1.5"
        >
          <FileTextIcon className="size-4 shrink-0 text-muted-foreground" />
          <span className="truncate">{node.title}</span>
        </Link>
        {canCreate ? (
          <button
            type="button"
            onClick={() => {
              setExpanded(true);
              onAddChild(node.id);
            }}
            className="rounded p-0.5 text-muted-foreground opacity-0 transition hover:bg-background group-hover:opacity-100 focus-visible:opacity-100"
            aria-label={`Add a page inside ${node.title}`}
          >
            <PlusIcon className="size-3.5" />
          </button>
        ) : null}
        {canEdit(node) ? (
          <DropdownMenu>
            <DropdownMenuTrigger
              className="rounded p-0.5 text-muted-foreground opacity-0 transition hover:bg-background group-hover:opacity-100 focus-visible:opacity-100 data-[state=open]:opacity-100"
              aria-label={`${node.title} options`}
            >
              <MoreHorizontalIcon className="size-3.5" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start">
              <ConfirmDialog
                trigger={
                  <DropdownMenuItem variant="destructive" onSelect={(event) => event.preventDefault()}>
                    <TrashIcon /> Delete
                  </DropdownMenuItem>
                }
                title={`Delete ${node.title}?`}
                description={hasChildren ? 'Its sub-pages will be deleted too.' : 'This page will be deleted.'}
                confirmLabel="Delete page"
                onConfirm={() => onDelete(node)}
              />
            </DropdownMenuContent>
          </DropdownMenu>
        ) : null}
      </div>
      {hasChildren && expanded ? (
        <ul role="group" className="grid gap-0.5">
          {node.children.map((child) => (
            <DocTreeItem key={child.id} node={child} depth={depth + 1} {...props} />
          ))}
        </ul>
      ) : null}
    </li>
  );
}
