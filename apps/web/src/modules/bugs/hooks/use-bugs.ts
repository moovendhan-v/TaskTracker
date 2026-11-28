import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { BugFilter, BugQaState, UpdateBugRequest } from '@taskflow/shared-types';
import { toast } from '@/components/ui/sonner';
import { getErrorMessage } from '@/lib/errors';
import { queryKeys } from '@/lib/query-keys';
import { bugsApi } from '../api/bugs.api';

// Under tasksRoot: a bug is a task, so any task change (status, assignee, title) refreshes these too.
export const bugKeys = {
  list: (workspaceId: string, spaceId: string, filter: BugFilter) => [...queryKeys.tasksRoot(workspaceId), 'bugs', spaceId, filter] as const,
  detail: (workspaceId: string, taskId: string) => [...queryKeys.tasksRoot(workspaceId), 'bug', taskId] as const,
  capture: (workspaceId: string, taskId: string) => [...queryKeys.tasksRoot(workspaceId), 'bug-capture', taskId] as const,
  similar: (workspaceId: string, spaceId: string, title: string, excludeTaskId: string | null) => [...queryKeys.tasksRoot(workspaceId), 'bug-similar', spaceId, title, excludeTaskId] as const,
};

export function useBugs(workspaceId: string, spaceId: string, filter: BugFilter) {
  return useQuery({ queryKey: bugKeys.list(workspaceId, spaceId, filter), queryFn: () => bugsApi.list(workspaceId, spaceId, filter), placeholderData: (previous) => previous });
}

export function useBug(workspaceId: string, taskId: string | null) {
  return useQuery({ queryKey: bugKeys.detail(workspaceId, taskId ?? ''), queryFn: () => bugsApi.get(workspaceId, taskId!), enabled: Boolean(taskId) });
}

export function useBugCapture(workspaceId: string, taskId: string | null) {
  return useQuery({ queryKey: bugKeys.capture(workspaceId, taskId ?? ''), queryFn: () => bugsApi.capture(workspaceId, taskId!), enabled: Boolean(taskId), staleTime: Infinity });
}

/** Reports with a similar title, for spotting a duplicate before (or after) filing. */
export function useSimilarBugs(workspaceId: string, spaceId: string, title: string, excludeTaskId: string | null = null) {
  const cleaned = title.trim();
  return useQuery({
    queryKey: bugKeys.similar(workspaceId, spaceId, cleaned, excludeTaskId),
    queryFn: () => bugsApi.similar(workspaceId, spaceId, cleaned, excludeTaskId),
    enabled: cleaned.length >= 4,
    staleTime: 30_000,
  });
}

export function useBugMutations(workspaceId: string) {
  const queryClient = useQueryClient();
  const invalidate = () => void queryClient.invalidateQueries({ queryKey: queryKeys.tasksRoot(workspaceId) });
  const onError = (error: unknown) => toast.error(getErrorMessage(error));
  return {
    update: useMutation({ mutationFn: ({ taskId, input }: { taskId: string; input: UpdateBugRequest }) => bugsApi.update(workspaceId, taskId, input), onSuccess: invalidate, onError }),
    setQaState: useMutation({ mutationFn: ({ taskId, state }: { taskId: string; state: BugQaState }) => bugsApi.setQaState(workspaceId, taskId, state), onSuccess: invalidate, onError }),
    markDuplicate: useMutation({ mutationFn: ({ taskId, ofTaskId }: { taskId: string; ofTaskId: string }) => bugsApi.markDuplicate(workspaceId, taskId, ofTaskId), onSuccess: invalidate, onError }),
  };
}
