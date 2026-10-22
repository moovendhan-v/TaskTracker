import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { CreateTaskListRequest, UpdateTaskListRequest } from '@taskflow/shared-types';
import { queryKeys } from '@/lib/query-keys';
import { listsApi } from '../api/lists.api';

export function useLists(workspaceId: string) {
  return useQuery({ queryKey: queryKeys.lists(workspaceId), queryFn: () => listsApi.list(workspaceId) });
}

export function useList(workspaceId: string, listId: string) {
  const query = useLists(workspaceId);
  return { ...query, data: query.data?.find((list) => list.id === listId) };
}

export function useListMutations(workspaceId: string) {
  const queryClient = useQueryClient();
  const invalidate = () => queryClient.invalidateQueries({ queryKey: queryKeys.lists(workspaceId) });
  return {
    create: useMutation({
      mutationFn: ({ spaceId, body }: { spaceId: string; body: CreateTaskListRequest }) => listsApi.create(workspaceId, spaceId, body),
      onSuccess: invalidate,
    }),
    update: useMutation({
      mutationFn: ({ listId, body }: { listId: string; body: UpdateTaskListRequest }) => listsApi.update(workspaceId, listId, body),
      onSuccess: invalidate,
    }),
    remove: useMutation({
      mutationFn: (listId: string) => listsApi.remove(workspaceId, listId),
      onSuccess: invalidate,
    }),
  };
}
