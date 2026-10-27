import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { CreateFolderRequest, CreateTaskListRequest, MoveFolderRequest, MoveTaskListRequest, UpdateFolderRequest, UpdateTaskListRequest } from '@taskflow/shared-types';
import { toast } from '@/components/ui/sonner';
import { getErrorMessage } from '@/lib/errors';
import { queryKeys } from '@/lib/query-keys';
import { foldersApi, listsApi } from '../api/lists.api';

export function useLists(workspaceId: string) {
  return useQuery({ queryKey: queryKeys.lists(workspaceId), queryFn: () => listsApi.list(workspaceId) });
}

export function useList(workspaceId: string, listId: string) {
  const query = useLists(workspaceId);
  return { ...query, data: query.data?.find((list) => list.id === listId) };
}

/** Every folder in the workspace; the sidebar nests them per space. */
export function useFolders(workspaceId: string) {
  return useQuery({ queryKey: queryKeys.folders(workspaceId), queryFn: () => foldersApi.list(workspaceId) });
}

export function useListMutations(workspaceId: string) {
  const queryClient = useQueryClient();
  // Folders live under the lists key, so this refreshes both.
  const invalidate = () => queryClient.invalidateQueries({ queryKey: queryKeys.lists(workspaceId) });
  const onError = (error: unknown) => toast.error(getErrorMessage(error));
  return {
    create: useMutation({
      mutationFn: ({ spaceId, body }: { spaceId: string; body: CreateTaskListRequest }) => listsApi.create(workspaceId, spaceId, body),
      onSuccess: invalidate,
    }),
    update: useMutation({
      mutationFn: ({ listId, body }: { listId: string; body: UpdateTaskListRequest }) => listsApi.update(workspaceId, listId, body),
      onSuccess: invalidate,
      onError,
    }),
    move: useMutation({
      mutationFn: ({ listId, body }: { listId: string; body: MoveTaskListRequest }) => listsApi.move(workspaceId, listId, body),
      onSuccess: invalidate,
      onError,
    }),
    remove: useMutation({
      mutationFn: (listId: string) => listsApi.remove(workspaceId, listId),
      onSuccess: invalidate,
    }),
  };
}

export function useFolderMutations(workspaceId: string) {
  const queryClient = useQueryClient();
  const invalidate = () => queryClient.invalidateQueries({ queryKey: queryKeys.lists(workspaceId) });
  const onError = (error: unknown) => toast.error(getErrorMessage(error));
  return {
    create: useMutation({
      mutationFn: ({ spaceId, body }: { spaceId: string; body: CreateFolderRequest }) => foldersApi.create(workspaceId, spaceId, body),
      onSuccess: invalidate,
    }),
    update: useMutation({
      mutationFn: ({ folderId, body }: { folderId: string; body: UpdateFolderRequest }) => foldersApi.update(workspaceId, folderId, body),
      onSuccess: invalidate,
      onError,
    }),
    move: useMutation({
      mutationFn: ({ folderId, body }: { folderId: string; body: MoveFolderRequest }) => foldersApi.move(workspaceId, folderId, body),
      onSuccess: invalidate,
      onError,
    }),
    remove: useMutation({ mutationFn: (folderId: string) => foldersApi.remove(workspaceId, folderId), onSuccess: invalidate, onError }),
  };
}
