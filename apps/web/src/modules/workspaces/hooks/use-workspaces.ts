import { useQuery } from '@tanstack/react-query';
import { queryKeys } from '@/lib/query-keys';
import { workspacesApi } from '../api/workspaces.api';

export function useWorkspaces() {
  return useQuery({ queryKey: queryKeys.workspaces, queryFn: workspacesApi.list });
}

export function useWorkspace(workspaceId: string) {
  return useQuery({ queryKey: queryKeys.workspace(workspaceId), queryFn: () => workspacesApi.get(workspaceId) });
}
