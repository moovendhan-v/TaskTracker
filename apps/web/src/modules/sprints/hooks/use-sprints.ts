import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { CompleteSprintRequest, CreateSprintRequest, SprintResponse, UpdateSprintRequest } from '@taskflow/shared-types';
import { toast } from '@/components/ui/sonner';
import { getErrorMessage } from '@/lib/errors';
import { queryKeys } from '@/lib/query-keys';
import { sprintsApi } from '../api/sprints.api';

export function useSprints(workspaceId: string, spaceId: string) {
  return useQuery({ queryKey: queryKeys.sprints(workspaceId, spaceId), queryFn: () => sprintsApi.listInSpace(workspaceId, spaceId) });
}

export function useSprint(workspaceId: string, sprintId: string) {
  return useQuery({ queryKey: queryKeys.sprint(workspaceId, sprintId), queryFn: () => sprintsApi.get({ workspaceId, sprintId }) });
}

/** Committed vs delivered; live while the sprint runs (it refreshes with the sprint's tasks). */
export function useSprintReport(workspaceId: string, sprintId: string, enabled: boolean) {
  return useQuery({ queryKey: [...queryKeys.sprint(workspaceId, sprintId), 'report'], queryFn: () => sprintsApi.report({ workspaceId, sprintId }), enabled });
}

export function useSprintTasks(workspaceId: string, sprintId: string) {
  return useQuery({ queryKey: queryKeys.sprintTasks(workspaceId, sprintId), queryFn: () => sprintsApi.tasks({ workspaceId, sprintId }) });
}

/** Who is on leave during a sprint; only fetched for people who can plan sprints. */
export function useSprintAvailability(workspaceId: string, sprint: Pick<SprintResponse, 'startDate' | 'endDate'>, enabled: boolean) {
  return useQuery({
    queryKey: ['workspaces', workspaceId, 'availability', sprint.startDate, sprint.endDate],
    queryFn: () => sprintsApi.availability(workspaceId, sprint.startDate, sprint.endDate),
    enabled,
    staleTime: 5 * 60_000,
  });
}

export function useBacklog(workspaceId: string, spaceId: string) {
  return useQuery({ queryKey: queryKeys.backlog(workspaceId, spaceId), queryFn: () => sprintsApi.backlog(workspaceId, spaceId) });
}

export function useSprintMutations(workspaceId: string, spaceId: string) {
  const queryClient = useQueryClient();
  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: queryKeys.sprintsRoot(workspaceId) });
    void queryClient.invalidateQueries({ queryKey: queryKeys.tasksRoot(workspaceId) });
  };
  const onError = (error: unknown) => toast.error(getErrorMessage(error));
  const path = (sprintId: string) => ({ workspaceId, sprintId });

  return {
    create: useMutation({ mutationFn: (body: CreateSprintRequest) => sprintsApi.create(workspaceId, spaceId, body), onSuccess: invalidate, onError }),
    update: useMutation({
      mutationFn: ({ sprintId, body }: { sprintId: string; body: UpdateSprintRequest }) => sprintsApi.update(path(sprintId), body),
      onSuccess: invalidate,
      onError,
    }),
    remove: useMutation({ mutationFn: (sprintId: string) => sprintsApi.remove(path(sprintId)), onSuccess: invalidate, onError }),
    start: useMutation({ mutationFn: (sprintId: string) => sprintsApi.start(path(sprintId)), onSuccess: invalidate, onError }),
    complete: useMutation({
      mutationFn: ({ sprintId, body }: { sprintId: string; body: CompleteSprintRequest }) => sprintsApi.complete(path(sprintId), body),
      onSuccess: invalidate,
      onError,
    }),
  };
}
