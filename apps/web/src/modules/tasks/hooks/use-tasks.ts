import { useQuery } from '@tanstack/react-query';
import { PAGE_SIZE_MAX } from '@taskflow/shared-types';
import { queryKeys } from '@/lib/query-keys';
import { tasksApi } from '../api/tasks.api';

/** First page of a list's tasks (up to the API's max page size), in board order. */
export function useTasks(workspaceId: string, listId: string, filters: { search?: string } = {}) {
  const query = { ...filters, pageSize: PAGE_SIZE_MAX };
  return useQuery({
    queryKey: queryKeys.tasks(workspaceId, listId, query),
    queryFn: () => tasksApi.searchInList(workspaceId, listId, query),
    placeholderData: (previous) => previous,
  });
}

export function useTask(workspaceId: string, taskId: string | undefined) {
  return useQuery({
    queryKey: queryKeys.task(workspaceId, taskId ?? ''),
    queryFn: () => tasksApi.get(workspaceId, taskId as string),
    enabled: Boolean(taskId),
  });
}

/** A space's statuses in workflow order. Every list in the space shares them. */
export function useStatuses(workspaceId: string, spaceId: string | undefined) {
  return useQuery({
    queryKey: queryKeys.statuses(workspaceId, spaceId ?? ''),
    queryFn: () => tasksApi.statuses(workspaceId, spaceId as string),
    enabled: Boolean(spaceId),
    staleTime: 5 * 60_000,
  });
}
