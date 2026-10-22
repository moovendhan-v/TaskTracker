import { useNavigate } from '@tanstack/react-router';
import { FilePlusIcon, FileTextIcon, SearchIcon } from 'lucide-react';
import { useDeferredValue, useMemo, useState } from 'react';
import { EmptyState } from '@/components/common/empty-state';
import { ErrorState } from '@/components/common/error-state';
import { FullPageSpinner } from '@/components/common/full-page-spinner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useCurrentUser } from '@/core/auth/use-current-user';
import { usePermissions } from '@/modules/workspaces';
import { DocEditor } from '../components/doc-editor';
import { DocTree } from '../components/doc-tree';
import { useDocument, useDocumentMutations, useDocumentTree } from '../hooks/use-documents';
import { buildDocumentTree, pathTo, type DocumentNode } from '../lib/build-tree';

interface DocumentsPageProps {
  workspaceId: string;
  documentId: string | undefined;
}

export function DocumentsPage({ workspaceId, documentId }: DocumentsPageProps) {
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const deferredSearch = useDeferredValue(search.trim());
  const tree = useDocumentTree(workspaceId, deferredSearch);
  const document = useDocument(workspaceId, documentId);
  const mutations = useDocumentMutations(workspaceId);
  const { data: me } = useCurrentUser();
  const { can } = usePermissions(workspaceId);

  const nodes = useMemo(() => buildDocumentTree(tree.data ?? []), [tree.data]);
  const expandedPath = useMemo(() => (documentId ? pathTo(tree.data ?? [], documentId) : []), [tree.data, documentId]);
  const canEdit = (doc: { createdById: string }) => can('doc.manage') || (can('doc.create') && doc.createdById === me?.id);

  const open = (id: string) => void navigate({ to: '/w/$workspaceId/docs/$documentId', params: { workspaceId, documentId: id } });
  const createPage = (parentId: string | null) =>
    mutations.create.mutate({ title: 'Untitled', parentId }, { onSuccess: (created) => open(created.id) });
  const deletePage = (node: DocumentNode) =>
    mutations.remove.mutateAsync(node.id).then(() => {
      if (expandedPath.includes(node.id)) void navigate({ to: '/w/$workspaceId/docs', params: { workspaceId } });
    });

  return (
    <div className="flex min-h-0 flex-1">
      <aside className="flex w-72 shrink-0 flex-col border-r bg-card/50" aria-label="Page tree">
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
            <Button size="icon-sm" variant="outline" onClick={() => createPage(null)} aria-label="New page" disabled={mutations.create.isPending}>
              <FilePlusIcon />
            </Button>
          ) : null}
        </div>
        <div className="flex-1 overflow-y-auto p-2">
          {tree.isLoading ? <FullPageSpinner /> : null}
          {tree.data?.length === 0 ? (
            <p className="p-2 text-sm text-muted-foreground">{deferredSearch ? 'No pages match.' : 'No pages yet.'}</p>
          ) : null}
          <DocTree
            workspaceId={workspaceId}
            nodes={nodes}
            activeId={documentId}
            expandedPath={expandedPath}
            canCreate={can('doc.create')}
            canEdit={canEdit}
            onAddChild={(parentId) => createPage(parentId)}
            onDelete={deletePage}
          />
        </div>
      </aside>
      <section className="min-w-0 flex-1 overflow-y-auto">
        {!documentId ? (
          <div className="p-10">
            <EmptyState
              icon={<FileTextIcon />}
              title="Docs live next to the work"
              description="Write specs, meeting notes and how-tos. Nest pages to keep them organised."
              action={
                can('doc.create') ? (
                  <Button onClick={() => createPage(null)}>
                    <FilePlusIcon /> New page
                  </Button>
                ) : undefined
              }
            />
          </div>
        ) : document.isLoading ? (
          <FullPageSpinner />
        ) : document.isError || !document.data ? (
          <ErrorState error={document.error} />
        ) : (
          <DocEditor key={document.data.id} workspaceId={workspaceId} document={document.data} canEdit={canEdit(document.data)} />
        )}
      </section>
    </div>
  );
}
