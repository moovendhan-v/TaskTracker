import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { PolicyDocument, SavePolicyRequest } from '@taskflow/shared-types';
import { toast } from '@/components/ui/sonner';
import { getErrorMessage } from '@/lib/errors';
import { queryKeys } from '@/lib/query-keys';
import { policiesApi } from '../api/policies.api';

export function usePolicies(workspaceId: string) {
  return useQuery({ queryKey: queryKeys.policies(workspaceId), queryFn: () => policiesApi.list(workspaceId) });
}

export function useProtectedFields(workspaceId: string) {
  return useQuery({ queryKey: [...queryKeys.policies(workspaceId), 'fields'], queryFn: () => policiesApi.fields(workspaceId), staleTime: Infinity });
}

export function usePolicyMutations(workspaceId: string) {
  const queryClient = useQueryClient();
  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: queryKeys.roles(workspaceId) });
    void queryClient.invalidateQueries({ queryKey: queryKeys.members(workspaceId) });
    // A policy change can change the caller's own access, and so what they see.
    void queryClient.invalidateQueries({ queryKey: queryKeys.workspace(workspaceId) });
    void queryClient.invalidateQueries({ queryKey: queryKeys.spaces(workspaceId) });
  };
  const onError = (error: unknown) => toast.error(getErrorMessage(error));
  return {
    create: useMutation({ mutationFn: (body: SavePolicyRequest) => policiesApi.create(workspaceId, body), onSuccess: invalidate }),
    update: useMutation({ mutationFn: ({ policyId, body }: { policyId: string; body: SavePolicyRequest }) => policiesApi.update(workspaceId, policyId, body), onSuccess: invalidate }),
    remove: useMutation({ mutationFn: (policyId: string) => policiesApi.remove(workspaceId, policyId), onSuccess: invalidate, onError }),
    attach: useMutation({ mutationFn: ({ roleId, policy }: { roleId: string; policy: string }) => policiesApi.attach(workspaceId, roleId, policy), onSuccess: invalidate, onError }),
    detach: useMutation({ mutationFn: ({ roleId, policy }: { roleId: string; policy: string }) => policiesApi.detach(workspaceId, roleId, policy), onSuccess: invalidate, onError }),
    setInline: useMutation({ mutationFn: ({ roleId, document }: { roleId: string; document: PolicyDocument }) => policiesApi.setInline(workspaceId, roleId, document), onSuccess: invalidate }),
  };
}
