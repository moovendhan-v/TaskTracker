import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { AddMemberRequest } from '@taskflow/shared-types';
import { queryKeys } from '@/lib/query-keys';
import { membersApi } from '../api/members.api';

export function useMembers(workspaceId: string) {
  return useQuery({ queryKey: queryKeys.members(workspaceId), queryFn: () => membersApi.list(workspaceId), staleTime: 60_000 });
}

/** Looks up a member's display name by user id; falls back for people who left. */
export function useMemberName(workspaceId: string) {
  const { data = [] } = useMembers(workspaceId);
  const names = new Map(data.map((member) => [member.userId, member.name]));
  return (userId: string | null) => (userId ? (names.get(userId) ?? 'Former member') : null);
}

export function useMemberMutations(workspaceId: string) {
  const queryClient = useQueryClient();
  const invalidate = () => queryClient.invalidateQueries({ queryKey: queryKeys.members(workspaceId) });
  return {
    add: useMutation({ mutationFn: (body: AddMemberRequest) => membersApi.add(workspaceId, body), onSuccess: invalidate }),
    updateRole: useMutation({
      mutationFn: ({ userId, roleId }: { userId: string; roleId: string }) => membersApi.updateRole(workspaceId, userId, { roleId }),
      onSuccess: invalidate,
    }),
    remove: useMutation({ mutationFn: (userId: string) => membersApi.remove(workspaceId, userId), onSuccess: invalidate }),
    leave: useMutation({
      mutationFn: () => membersApi.leave(workspaceId),
      onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.workspaces }),
    }),
  };
}
