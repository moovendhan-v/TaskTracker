import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { CreateDocumentRequest, DocumentResponse, MoveDocumentRequest, UpdateDocumentRequest } from '@taskflow/shared-types';
import { toast } from '@/components/ui/sonner';
import { getErrorMessage } from '@/lib/errors';
import { queryKeys } from '@/lib/query-keys';
import { documentsApi } from '../api/documents.api';

export function useDocumentTree(workspaceId: string, search = '') {
  return useQuery({
    queryKey: queryKeys.documentTree(workspaceId, search),
    queryFn: () => documentsApi.tree(workspaceId, search || undefined),
    placeholderData: (previous) => previous,
  });
}

export function useDocument(workspaceId: string, documentId: string | undefined) {
  return useQuery({
    queryKey: queryKeys.document(workspaceId, documentId ?? ''),
    queryFn: () => documentsApi.get({ workspaceId, documentId: documentId as string }),
    enabled: Boolean(documentId),
  });
}

export function useDocumentMutations(workspaceId: string) {
  const queryClient = useQueryClient();
  const invalidateTree = () => queryClient.invalidateQueries({ queryKey: queryKeys.documentsRoot(workspaceId) });
  const onError = (error: unknown) => toast.error(getErrorMessage(error));
  const path = (documentId: string) => ({ workspaceId, documentId });

  return {
    create: useMutation({ mutationFn: (body: CreateDocumentRequest) => documentsApi.create(workspaceId, body), onSuccess: invalidateTree, onError }),
    update: useMutation({
      mutationFn: ({ documentId, body }: { documentId: string; body: UpdateDocumentRequest }) => documentsApi.update(path(documentId), body),
      onSuccess: (document: DocumentResponse) => {
        queryClient.setQueryData(queryKeys.document(workspaceId, document.id), document);
        // Only the title shows in the tree; refresh it without refetching the open page.
        void queryClient.invalidateQueries({ queryKey: ['workspaces', workspaceId, 'documents', 'tree'] });
      },
      onError,
    }),
    move: useMutation({
      mutationFn: ({ documentId, body }: { documentId: string; body: MoveDocumentRequest }) => documentsApi.move(path(documentId), body),
      onSuccess: invalidateTree,
      onError,
    }),
    remove: useMutation({ mutationFn: (documentId: string) => documentsApi.remove(path(documentId)), onSuccess: invalidateTree, onError }),
  };
}
