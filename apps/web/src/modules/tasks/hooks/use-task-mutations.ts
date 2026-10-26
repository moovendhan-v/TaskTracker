import { useMutation, useQueryClient, type InfiniteData } from '@tanstack/react-query';
import type { CreateTaskRequest, Paginated, TaskRelationKind, TaskResponse, TaskStatusResponse, UpdateTaskRequest } from '@taskflow/shared-types';
import { notify } from '@/components/kit/notify';
import { queryKeys } from '@/lib/query-keys';
import { tasksApi } from '../api/tasks.api';

type TaskPage = Paginated<TaskResponse>;
type Cached = TaskPage | TaskResponse | TaskResponse[] | InfiniteData<TaskPage>;

/** Where a new task goes: a list, or a space when no list is chosen. */
export interface CreateVariables {
  listId?: string;
  spaceId?: string;
  body: CreateTaskRequest;
}

interface UpdateVariables {
  taskId: string;
  body: UpdateTaskRequest;
  /** The status `body.statusId` points at, so the optimistic copy can show it before the server answers. */
  status?: TaskStatusResponse;
}

/** Applies a change to whatever shape a cached task query holds: one task, a list, a page or paged pages. */
function patchCached(data: Cached | undefined, taskId: string, patch: (task: TaskResponse) => TaskResponse): Cached | undefined {
  if (!data) return data;
  const each = (task: TaskResponse) => (task.id === taskId ? patch(task) : task);
  if (Array.isArray(data)) return data.map(each);
  if ('pages' in data) return { ...data, pages: data.pages.map((page) => ({ ...page, items: page.items.map(each) })) };
  if ('items' in data) return { ...data, items: data.items.map(each) };
  return 'id' in data ? each(data) : data;
}

export function useTaskMutations(workspaceId: string) {
  const queryClient = useQueryClient();
  const tasksRoot = queryKeys.tasksRoot(workspaceId);
  const invalidate = () => {
    // Sprint progress and dashboards count tasks by status and sprint.
    void queryClient.invalidateQueries({ queryKey: queryKeys.sprintsRoot(workspaceId) });
    void queryClient.invalidateQueries({ queryKey: queryKeys.dashboardRoot(workspaceId) });
    return queryClient.invalidateQueries({ queryKey: tasksRoot });
  };
  const onError = (error: unknown) => notify.error(error);

  /** Into a list, or straight into a space (its first list, added if it has none). */
  const create = useMutation({
    mutationFn: ({ listId, spaceId, body }: CreateVariables) => {
      if (listId) return tasksApi.create(workspaceId, listId, body);
      if (spaceId) return tasksApi.createInSpace(workspaceId, spaceId, body);
      throw new Error('Choose a project');
    },
    onSuccess: (_task, { listId }) => {
      if (!listId) void queryClient.invalidateQueries({ queryKey: queryKeys.lists(workspaceId) });
      return invalidate();
    },
    onError,
  });

  /** Optimistic: the row or card moves at once and rolls back if the server refuses. */
  const update = useMutation({
    mutationFn: ({ taskId, body }: UpdateVariables) => tasksApi.update(workspaceId, taskId, body),
    onMutate: async ({ taskId, body, status }) => {
      await queryClient.cancelQueries({ queryKey: tasksRoot });
      const snapshot = queryClient.getQueriesData<Cached>({ queryKey: tasksRoot });
      queryClient.setQueriesData<Cached>({ queryKey: tasksRoot }, (data) => patchCached(data, taskId, (task) => applyPatch(task, body, status)));
      return { snapshot };
    },
    onError: (error, _variables, context) => {
      context?.snapshot.forEach(([key, data]) => queryClient.setQueryData(key, data));
      onError(error);
    },
    onSettled: invalidate,
  });

  /** The same change to several tasks (bulk bar). Stops at the first refusal and reports it. */
  const updateMany = useMutation({
    mutationFn: async ({ taskIds, body }: { taskIds: readonly string[]; body: UpdateTaskRequest }) => {
      for (const taskId of taskIds) await tasksApi.update(workspaceId, taskId, body);
      return taskIds.length;
    },
    onSuccess: (count) => notify.success(`Updated ${count} task${count === 1 ? '' : 's'}`),
    onError,
    onSettled: invalidate,
  });

  const remove = useMutation({ mutationFn: (taskId: string) => tasksApi.remove(workspaceId, taskId), onSuccess: invalidate, onError });

  const watch = useMutation({
    mutationFn: ({ taskId, watching }: { taskId: string; watching: boolean }) => tasksApi.watch(workspaceId, taskId, watching),
    onSuccess: (_result, { taskId }) => queryClient.invalidateQueries({ queryKey: queryKeys.taskWatchers(workspaceId, taskId) }),
    onError,
  });

  const relate = useMutation({
    mutationFn: ({ taskId, relatedTaskId, kind }: { taskId: string; relatedTaskId: string; kind: TaskRelationKind }) => tasksApi.relate(workspaceId, taskId, relatedTaskId, kind),
    onSuccess: invalidate,
    onError,
  });

  /** Links to a task by its number, as people type it ("#42" or "42"). */
  const relateByNumber = useMutation({
    mutationFn: async ({ taskId, number, kind }: { taskId: string; number: number; kind: TaskRelationKind }) => {
      const other = await tasksApi.byNumber(workspaceId, number);
      return tasksApi.relate(workspaceId, taskId, other.id, kind);
    },
    onSuccess: invalidate,
    onError,
  });

  const unrelate = useMutation({ mutationFn: (relationId: string) => tasksApi.unrelate(workspaceId, relationId), onSuccess: invalidate, onError });

  return { create, update, updateMany, remove, watch, relate, relateByNumber, unrelate };
}

function applyPatch(task: TaskResponse, body: UpdateTaskRequest, status: TaskStatusResponse | undefined): TaskResponse {
  const { title, description, priority, startDate, dueDate, assigneeId, position, sprintId, type, estimateMinutes, progress } = body;
  return {
    ...task,
    ...(title !== undefined && { title }),
    ...(description !== undefined && { description }),
    ...(status !== undefined && status.id === body.statusId && { status, statusId: status.id }),
    ...(priority !== undefined && { priority }),
    ...(startDate !== undefined && { startDate }),
    ...(dueDate !== undefined && { dueDate }),
    ...(assigneeId !== undefined && { assigneeId }),
    ...(position !== undefined && { position }),
    ...(sprintId !== undefined && { sprintId }),
    ...(type !== undefined && { type }),
    ...(estimateMinutes !== undefined && { estimateMinutes }),
    ...(progress !== undefined && { progress }),
  };
}
