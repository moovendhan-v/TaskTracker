import { useNavigate } from '@tanstack/react-router';
import { Link } from '@tanstack/react-router';
import { ChevronRightIcon, FilePlusIcon, FileTextIcon, FolderPlusIcon, PanelLeftIcon, SearchIcon } from 'lucide-react';
import type { DocKind } from '@taskflow/shared-types';
import { useDeferredValue, useMemo, useState } from 'react';
import { EmptyState } from '@/components/common/empty-state';
import { ErrorState } from '@/components/common/error-state';
import { FullPageSpinner } from '@/components/common/full-page-spinner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/cn';
import { useCurrentUser } from '@/core/auth/use-current-user';
import { useSpaces } from '@/modules/spaces';
import { usePermissions } from '@/modules/workspaces';
import { DocEditor } from '../components/doc-editor';
import { DocTree } from '../components/doc-tree';
import { FolderView } from '../components/folder-view';
import { useDocument, useDocumentMutations, useDocumentTree } from '../hooks/use-documents';
import { buildDocumentTree, findNode, pathTo, type DocumentNode } from '../lib/build-tree';

interface DocumentsPageProps {
  workspaceId: string;
  documentId: string | undefined;
}

export function DocumentsPage({ workspaceId, documentId }: DocumentsPageProps) {
  const navigate = useNavigate();
  const [treeOpen, setTreeOpen] = useState(true);
  const [search, setSearch] = useState('');
  const deferredSearch = useDeferredValue(search.trim());
  const tree = useDocumentTree(workspaceId, deferredSearch);
  const document = useDocument(workspaceId, documentId);
  const mutations = useDocumentMutations(workspaceId);
  const { data: me } = useCurrentUser();
  const { can } = usePermissions(workspaceId);
  const { data: spaces = [] } = useSpaces(workspaceId);

  const nodes = useMemo(() => buildDocumentTree(tree.data ?? []), [tree.data]);
  const expandedPath = useMemo(() => (documentId ? pathTo(tree.data ?? [], documentId) : []), [tree.data, documentId]);
  const canEdit = (doc: { createdById: string }) => can('doc.manage') || (can('doc.create') && doc.createdById === me?.id);

  const open = (id: string) => void navigate({ to: '/w/$workspaceId/docs/$documentId', params: { workspaceId, documentId: id } });
  const createPage = (parentId: string | null, kind: DocKind = 'page') =>
    mutations.create.mutate({ title: kind === 'folder' ? 'New folder' : 'Untitled', kind, parentId }, { onSuccess: (created) => open(created.id) });
  const rename = (id: string, title: string) => mutations.update.mutate({ documentId: id, body: { title } });
  const titleOf = new Map((tree.data ?? []).map((doc) => [doc.id, doc.title]));
  const deletePage = (node: DocumentNode) =>
    mutations.remove.mutateAsync(node.id).then(() => {
      if (expandedPath.includes(node.id)) void navigate({ to: '/w/$workspaceId/docs', params: { workspaceId } });
    });

  return (
    <div className="flex min-h-0 flex-1">
      <aside
        className={cn(
          'flex w-72 shrink-0 flex-col border-r bg-card/50 transition-all duration-200',
          !treeOpen && 'hidden'
        )}
        aria-label="Page tree"
      >
        <div className="flex items-center gap-2 border-b p-3">
          <div className="relative flex-1">
            <SearchIcon className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search pages"
              aria-label="Search pages"
              maxLength={100}
              className="h-8 pl-8"
            />
          </div>
          {can('doc.create') ? (
            <>
              <Button size="icon-sm" variant="outline" onClick={() => createPage(null, 'folder')} aria-label="New folder" title="New folder" disabled={mutations.create.isPending}>
                <FolderPlusIcon />
              </Button>
              <Button size="icon-sm" variant="outline" onClick={() => createPage(null)} aria-label="New page" title="New page" disabled={mutations.create.isPending}>
                <FilePlusIcon />
              </Button>
            </>
          ) : null}
        </div>
        <div className="flex flex-1 flex-col overflow-y-auto p-2">
          {tree.isLoading ? <FullPageSpinner /> : null}
          {tree.data?.length === 0 ? (
            <p className="p-2 text-sm text-muted-foreground">{deferredSearch ? 'No pages match.' : 'No pages yet.'}</p>
          ) : null}
          <DocTree
            workspaceId={workspaceId}
            nodes={nodes}
            documents={tree.data ?? []}
            activeId={documentId}
            expandedPath={expandedPath}
            canCreate={can('doc.create')}
            canEdit={canEdit}
            onAdd={createPage}
            onRename={(node, title) => rename(node.id, title)}
            onMove={(id, placement) => mutations.move.mutate({ documentId: id, body: placement })}
            onDelete={deletePage}
            onSetIcon={(node, icon) => mutations.update.mutate({ documentId: node.id, body: { icon } })}
            spaces={spaces}
            onSetSpace={(node, spaceId) => mutations.move.mutate({ documentId: node.id, body: { parentId: null, position: node.position, spaceId } })}
          />
        </div>
      </aside>
      <section className="min-w-0 flex-1 overflow-y-auto">
        {!documentId ? (
          <div className="p-10">
            {!treeOpen ? (
              <div className="mb-6">
                <Button variant="outline" size="sm" onClick={() => setTreeOpen(true)} className="gap-1.5 text-xs">
                  <PanelLeftIcon className="size-3.5" />
                  <span>Show page tree</span>
                </Button>
              </div>
            ) : null}
            <EmptyState
              icon={<FileTextIcon />}
              title="Docs live next to the work"
              description="Write specs, meeting notes and how-tos. Group them in folders, and drag pages between folders to reorganise."
              action={
                can('doc.create') ? (
                  <div className="flex gap-2">
                    <Button variant="outline" onClick={() => createPage(null, 'folder')}>
                      <FolderPlusIcon /> New folder
                    </Button>
                    <Button onClick={() => createPage(null)}>
                      <FilePlusIcon /> New page
                    </Button>
                  </div>
                ) : undefined
              }
            />
          </div>
        ) : document.isLoading ? (
          <FullPageSpinner />
        ) : document.isError || !document.data ? (
          <ErrorState error={document.error} />
        ) : (
          <>
            {expandedPath.length > 1 || (!treeOpen && document.data.kind === 'folder') ? (
              <nav aria-label="Breadcrumb" className="mx-auto flex w-full max-w-4xl flex-wrap items-center gap-1.5 px-6 pt-4 text-xs text-muted-foreground">
                {!treeOpen ? (
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    className="size-6 mr-1"
                    onClick={() => setTreeOpen(true)}
                    title="Open sidebar"
                  >
                    <PanelLeftIcon className="size-3.5" />
                  </Button>
                ) : null}
                {expandedPath.slice(0, -1).map((id) => (
                  <span key={id} className="flex items-center gap-1">
                    <Link to="/w/$workspaceId/docs/$documentId" params={{ workspaceId, documentId: id }} className="hover:text-foreground">
                      {titleOf.get(id)}
                    </Link>
                    <ChevronRightIcon className="size-3" />
                  </span>
                ))}
              </nav>
            ) : null}
            {document.data.kind === 'folder' ? (
              <FolderView
                key={document.data.id}
                workspaceId={workspaceId}
                folder={document.data}
                items={findNode(nodes, document.data.id)?.children ?? []}
                canEdit={canEdit(document.data)}
                canCreate={can('doc.create')}
                onRename={(title) => rename(document.data.id, title)}
                onAdd={(kind) => createPage(document.data.id, kind)}
              />
            ) : (
              <DocEditor
                key={document.data.id}
                workspaceId={workspaceId}
                document={document.data}
                canEdit={canEdit(document.data)}
                treeOpen={treeOpen}
                onToggleTree={() => setTreeOpen((prev) => !prev)}
              />
            )}
          </>
        )}
      </section>
    </div>
  );
}
