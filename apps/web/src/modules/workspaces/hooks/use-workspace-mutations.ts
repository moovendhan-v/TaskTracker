import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { CreateWorkspaceRequest, UpdateWorkspaceRequest } from '@taskflow/shared-types';
import { queryKeys } from '@/lib/query-keys';
import { workspacesApi } from '../api/workspaces.api';

export function useCreateWorkspace() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: CreateWorkspaceRequest) => workspacesApi.create(body),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.workspaces }),
  });
}

export function useUpdateWorkspace(workspaceId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: UpdateWorkspaceRequest) => workspacesApi.update(workspaceId, body),
    onSuccess: (workspace) => {
      queryClient.setQueryData(queryKeys.workspace(workspaceId), workspace);
      void queryClient.invalidateQueries({ queryKey: queryKeys.workspaces, exact: true });
    },
  });
}

export function useDeleteWorkspace(workspaceId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => workspacesApi.remove(workspaceId),
    onSuccess: () => {
      queryClient.removeQueries({ queryKey: queryKeys.workspace(workspaceId) });
      void queryClient.invalidateQueries({ queryKey: queryKeys.workspaces, exact: true });
    },
  });
}
