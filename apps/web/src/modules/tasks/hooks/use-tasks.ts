import { keepPreviousData, useInfiniteQuery, useQuery } from '@tanstack/react-query';
import { PAGE_SIZE_MAX, type ResourceQuery } from '@taskflow/shared-types';
import { queryKeys } from '@/lib/query-keys';
import { tasksApi, type TaskScope } from '../api/tasks.api';

/**
 * Tasks matching a query, a page (the API's max size) at a time. Views show
 * what is loaded and offer the next page, so large projects stay fast.
 */
export function useTaskSearch(workspaceId: string, scope: TaskScope, query: Omit<ResourceQuery, 'page' | 'pageSize'>, enabled = true) {
  return useInfiniteQuery({
    queryKey: queryKeys.taskSearch(workspaceId, { ...scope, ...query }),
    queryFn: ({ pageParam }) => tasksApi.search(workspaceId, scope, { ...query, page: pageParam, pageSize: PAGE_SIZE_MAX }),
    initialPageParam: 1,
    getNextPageParam: (last) => (last.page * last.pageSize < last.total ? last.page + 1 : undefined),
    select: (data) => ({ items: data.pages.flatMap((page) => page.items), total: data.pages[0]?.total ?? 0 }),
    placeholderData: keepPreviousData,
    enabled,
  });
}

/** One page of a list's tasks (kept for simple callers). */
export function useTasks(workspaceId: string, listId: string, filters: { search?: string } = {}) {
  const query = { ...filters, pageSize: PAGE_SIZE_MAX };
  return useQuery({
    queryKey: queryKeys.tasks(workspaceId, listId, query),
    queryFn: () => tasksApi.search(workspaceId, { listId }, query),
    placeholderData: keepPreviousData,
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

export function useSubtasks(workspaceId: string, taskId: string) {
  return useQuery({ queryKey: queryKeys.subtasks(workspaceId, taskId), queryFn: () => tasksApi.subtasks(workspaceId, taskId) });
}

export function useTaskRelations(workspaceId: string, taskId: string) {
  return useQuery({ queryKey: queryKeys.taskRelations(workspaceId, taskId), queryFn: () => tasksApi.relations(workspaceId, taskId) });
}

export function useTaskActivity(workspaceId: string, taskId: string) {
  return useQuery({ queryKey: queryKeys.taskActivity(workspaceId, taskId), queryFn: () => tasksApi.activity(workspaceId, taskId) });
}

export function useTaskWatchers(workspaceId: string, taskId: string) {
  return useQuery({ queryKey: queryKeys.taskWatchers(workspaceId, taskId), queryFn: () => tasksApi.watchers(workspaceId, taskId) });
}
