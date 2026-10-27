import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { SaveGithubConnectionRequest } from '@taskflow/shared-types';
import { toast } from '@/components/ui/sonner';
import { getErrorMessage } from '@/lib/errors';
import { queryKeys } from '@/lib/query-keys';
import { integrationsApi } from '../api/integrations.api';

export function useGithubConnections(workspaceId: string, enabled: boolean) {
  return useQuery({ queryKey: queryKeys.integrations(workspaceId), queryFn: () => integrationsApi.githubConnections(workspaceId), enabled });
}

export function useTaskPullRequests(workspaceId: string, taskId: string) {
  return useQuery({ queryKey: queryKeys.taskPullRequests(workspaceId, taskId), queryFn: () => integrationsApi.taskPullRequests(workspaceId, taskId) });
}

export function useGithubMutations(workspaceId: string) {
  const queryClient = useQueryClient();
  const invalidate = () => queryClient.invalidateQueries({ queryKey: queryKeys.integrations(workspaceId) });
  const onError = (error: unknown) => toast.error(getErrorMessage(error));
  return {
    connect: useMutation({ mutationFn: (body: SaveGithubConnectionRequest) => integrationsApi.connectGithub(workspaceId, body), onSuccess: invalidate }),
    update: useMutation({
      mutationFn: ({ connectionId, body }: { connectionId: string; body: Omit<SaveGithubConnectionRequest, 'repo'> }) => integrationsApi.updateGithub(workspaceId, connectionId, body),
      onSuccess: invalidate,
      onError,
    }),
    rotate: useMutation({ mutationFn: (connectionId: string) => integrationsApi.rotateGithubSecret(workspaceId, connectionId), onSuccess: invalidate, onError }),
    disconnect: useMutation({ mutationFn: (connectionId: string) => integrationsApi.disconnectGithub(workspaceId, connectionId), onSuccess: invalidate, onError }),
  };
}
