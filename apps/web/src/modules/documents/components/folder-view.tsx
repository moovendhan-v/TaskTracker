import { Link } from '@tanstack/react-router';
import { FilePlusIcon, FileTextIcon, FolderIcon, FolderPlusIcon } from 'lucide-react';
import { DOC_TITLE_MAX, type DocKind, type DocumentResponse } from '@taskflow/shared-types';
import { Button } from '@/components/ui/button';
import { formatLongDate } from '@/lib/dates';
import { useResettableState } from '@/lib/use-resettable-state';
import type { DocumentNode } from '../lib/build-tree';

interface FolderViewProps {
  workspaceId: string;
  folder: DocumentResponse;
  /** What the folder holds, folders first. */
  items: readonly DocumentNode[];
  canEdit: boolean;
  canCreate: boolean;
  onRename: (title: string) => void;
  onAdd: (kind: DocKind) => void;
}

/** An open folder: its name (editable) and what's inside, with buttons to add more. */
export function FolderView({ workspaceId, folder, items, canEdit, canCreate, onRename, onAdd }: FolderViewProps) {
  const [title, setTitle] = useResettableState(folder.title);
  const sorted = [...items].sort((a, b) => Number(b.kind === 'folder') - Number(a.kind === 'folder'));
  return (
    <article className="mx-auto grid w-full max-w-3xl gap-5 p-8">
      <div className="flex items-center gap-3">
        <FolderIcon className="size-7 shrink-0 text-primary" />
        <input
          value={title}
          maxLength={DOC_TITLE_MAX}
          readOnly={!canEdit}
          onChange={(event) => setTitle(event.target.value)}
          onBlur={() => title.trim() && title.trim() !== folder.title && onRename(title.trim())}
          onKeyDown={(event) => event.key === 'Enter' && event.currentTarget.blur()}
          aria-label="Folder name"
          className="min-w-0 flex-1 bg-transparent text-3xl font-bold tracking-tight outline-none"
        />
        {canCreate ? (
          <div className="flex gap-2">
            <Button size="sm" variant="outline" onClick={() => onAdd('folder')}>
              <FolderPlusIcon /> New folder
            </Button>
            <Button size="sm" onClick={() => onAdd('page')}>
              <FilePlusIcon /> New page
            </Button>
          </div>
        ) : null}
      </div>
      {sorted.length === 0 ? (
        <p className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">This folder is empty. Add a page, or drag pages and folders onto it in the tree.</p>
      ) : (
        <ul className="grid gap-1 sm:grid-cols-2">
          {sorted.map((item) => (
            <li key={item.id}>
              <Link
                to="/w/$workspaceId/docs/$documentId"
                params={{ workspaceId, documentId: item.id }}
                className="flex items-center gap-3 rounded-lg border bg-card px-3 py-2.5 hover:border-primary/50 hover:bg-muted/40"
              >
                {item.kind === 'folder' ? <FolderIcon className="size-5 shrink-0 text-primary" /> : <FileTextIcon className="size-5 shrink-0 text-muted-foreground" />}
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium">{item.title}</span>
                  <span className="block text-xs text-muted-foreground">
                    {item.kind === 'folder' ? `${item.children.length} item${item.children.length === 1 ? '' : 's'}` : `Updated ${formatLongDate(item.updatedAt)}`}
                  </span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </article>
  );
}
