import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { SaveAutomationRequest } from '@taskflow/shared-types';
import { toast } from '@/components/ui/sonner';
import { getErrorMessage } from '@/lib/errors';
import { queryKeys } from '@/lib/query-keys';
import { automationsApi } from '../api/automations.api';

export function useAutomations(workspaceId: string, spaceId: string) {
  return useQuery({ queryKey: queryKeys.automations(workspaceId, spaceId), queryFn: () => automationsApi.list(workspaceId, spaceId) });
}

export function useAutomationRuns(workspaceId: string, ruleId: string | null) {
  return useQuery({ queryKey: queryKeys.automationRuns(workspaceId, ruleId ?? ''), queryFn: () => automationsApi.runs(workspaceId, ruleId as string), enabled: Boolean(ruleId) });
}

export function useAutomationMutations(workspaceId: string, spaceId: string) {
  const queryClient = useQueryClient();
  const invalidate = () => queryClient.invalidateQueries({ queryKey: queryKeys.automationsRoot(workspaceId) });
  const onError = (error: unknown) => toast.error(getErrorMessage(error));
  return {
    create: useMutation({ mutationFn: (body: SaveAutomationRequest) => automationsApi.create(workspaceId, spaceId, body), onSuccess: invalidate }),
    update: useMutation({ mutationFn: ({ ruleId, body }: { ruleId: string; body: SaveAutomationRequest }) => automationsApi.update(workspaceId, ruleId, body), onSuccess: invalidate }),
    setEnabled: useMutation({ mutationFn: ({ ruleId, enabled }: { ruleId: string; enabled: boolean }) => automationsApi.setEnabled(workspaceId, ruleId, enabled), onSuccess: invalidate, onError }),
    remove: useMutation({ mutationFn: (ruleId: string) => automationsApi.remove(workspaceId, ruleId), onSuccess: invalidate, onError }),
  };
}
