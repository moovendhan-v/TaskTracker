import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from '@/components/ui/sonner';
import { getErrorMessage } from '@/lib/errors';
import { queryKeys } from '@/lib/query-keys';
import { qaApi } from '../api/qa.api';

/** Under tasksRoot: runs file and verify bugs, so task changes and QA refresh together. */
export const qaKeys = {
  root: (workspaceId: string) => [...queryKeys.tasksRoot(workspaceId), 'qa'] as const,
  suites: (workspaceId: string, spaceId: string) => [...qaKeys.root(workspaceId), 'suites', spaceId] as const,
  cases: (workspaceId: string, spaceId: string, filter: object) => [...qaKeys.root(workspaceId), 'cases', spaceId, filter] as const,
  caseRuns: (workspaceId: string, caseId: string) => [...qaKeys.root(workspaceId), 'case-runs', caseId] as const,
  plans: (workspaceId: string, spaceId: string) => [...qaKeys.root(workspaceId), 'plans', spaceId] as const,
  planCases: (workspaceId: string, planId: string) => [...qaKeys.root(workspaceId), 'plan-cases', planId] as const,
  readiness: (workspaceId: string, planId: string) => [...qaKeys.root(workspaceId), 'readiness', planId] as const,
  coverage: (workspaceId: string, spaceId: string) => [...qaKeys.root(workspaceId), 'coverage', spaceId] as const,
};

export const useQaSuites = (workspaceId: string, spaceId: string) => useQuery({ queryKey: qaKeys.suites(workspaceId, spaceId), queryFn: () => qaApi.suites(workspaceId, spaceId) });
export const useQaCases = (workspaceId: string, spaceId: string, filter: { suiteId?: string | null; search?: string | null }) =>
  useQuery({ queryKey: qaKeys.cases(workspaceId, spaceId, filter), queryFn: () => qaApi.cases(workspaceId, spaceId, filter), placeholderData: (previous) => previous });
export const useQaCaseRuns = (workspaceId: string, caseId: string | null) => useQuery({ queryKey: qaKeys.caseRuns(workspaceId, caseId ?? ''), queryFn: () => qaApi.caseRuns(workspaceId, caseId!), enabled: Boolean(caseId) });
export const useQaPlans = (workspaceId: string, spaceId: string) => useQuery({ queryKey: qaKeys.plans(workspaceId, spaceId), queryFn: () => qaApi.plans(workspaceId, spaceId) });
export const useQaPlanCases = (workspaceId: string, planId: string) => useQuery({ queryKey: qaKeys.planCases(workspaceId, planId), queryFn: () => qaApi.planCases(workspaceId, planId) });
export const useQaReadiness = (workspaceId: string, planId: string) => useQuery({ queryKey: qaKeys.readiness(workspaceId, planId), queryFn: () => qaApi.readiness(workspaceId, planId) });
export const useQaCoverage = (workspaceId: string, spaceId: string) => useQuery({ queryKey: qaKeys.coverage(workspaceId, spaceId), queryFn: () => qaApi.coverage(workspaceId, spaceId) });

/** Wraps a QA call: refreshes everything QA (and tasks) afterwards, toasts failures. */
export function useQaMutation<TArgs, TResult>(workspaceId: string, run: (args: TArgs) => Promise<TResult>, success?: (result: TResult) => string | null) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: run,
    onSuccess: (result) => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.tasksRoot(workspaceId) });
      const message = success?.(result);
      if (message) toast.success(message);
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  });
}
