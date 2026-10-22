import { useQuery } from '@tanstack/react-query';
import { PAGE_SIZE_MAX, type TaskQuery } from '@taskflow/shared-types';
import { queryKeys } from '@/lib/query-keys';
import { tasksApi } from '../api/tasks.api';

/** First page of a list's tasks (up to the API's max page size). */
export function useTasks(workspaceId: string, listId: string, filters: Pick<TaskQuery, 'search' | 'status'> = {}) {
  const query: TaskQuery = { ...filters, pageSize: PAGE_SIZE_MAX };
  return useQuery({
    queryKey: queryKeys.tasks(workspaceId, listId, query),
    queryFn: () => tasksApi.listInList(workspaceId, listId, query),
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
