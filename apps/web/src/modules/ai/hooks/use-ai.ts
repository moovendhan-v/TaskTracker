import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { UpdateAiSettingsRequest } from '@taskflow/shared-types';
import { queryKeys } from '@/lib/query-keys';
import { aiApi, type SummaryTarget } from '../api/ai.api';

const settingsKey = (workspaceId: string) => [...queryKeys.workspace(workspaceId), 'ai'] as const;

export function useAiSettings(workspaceId: string) {
  return useQuery({ queryKey: settingsKey(workspaceId), queryFn: () => aiApi.settings(workspaceId), staleTime: 60_000 });
}

export function useUpdateAiSettings(workspaceId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: UpdateAiSettingsRequest) => aiApi.updateSettings(workspaceId, input),
    onSuccess: (saved) => queryClient.setQueryData(settingsKey(workspaceId), saved),
  });
}

export function useSummarize(workspaceId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (target: SummaryTarget) => aiApi.summarize(workspaceId, target),
    // Keep the usage shown in settings in step.
    onSuccess: (summary) => queryClient.setQueryData(settingsKey(workspaceId), (old: Awaited<ReturnType<typeof aiApi.settings>> | undefined) => (old ? { ...old, usedToday: summary.usedToday } : old)),
  });
}
