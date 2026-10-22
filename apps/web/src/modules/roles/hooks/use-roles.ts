import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { CreateRoleRequest, UpdateRoleRequest } from '@taskflow/shared-types';
import { queryKeys } from '@/lib/query-keys';
import { rolesApi } from '../api/roles.api';

export function useRoles(workspaceId: string) {
  return useQuery({ queryKey: queryKeys.roles(workspaceId), queryFn: () => rolesApi.list(workspaceId) });
}

export function useRoleMutations(workspaceId: string) {
  const queryClient = useQueryClient();
  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: queryKeys.roles(workspaceId) });
    void queryClient.invalidateQueries({ queryKey: queryKeys.members(workspaceId) });
    // A role change can change the caller's own permissions.
    void queryClient.invalidateQueries({ queryKey: queryKeys.workspace(workspaceId) });
  };
  return {
    create: useMutation({ mutationFn: (body: CreateRoleRequest) => rolesApi.create(workspaceId, body), onSuccess: invalidate }),
    update: useMutation({
      mutationFn: ({ roleId, body }: { roleId: string; body: UpdateRoleRequest }) => rolesApi.update(workspaceId, roleId, body),
      onSuccess: invalidate,
    }),
    remove: useMutation({ mutationFn: (roleId: string) => rolesApi.remove(workspaceId, roleId), onSuccess: invalidate }),
  };
}
