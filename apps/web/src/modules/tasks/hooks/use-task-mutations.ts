import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { CreateTaskRequest, Paginated, TaskResponse, UpdateTaskRequest } from '@taskflow/shared-types';
import { toast } from '@/components/ui/sonner';
import { getErrorMessage } from '@/lib/errors';
import { queryKeys } from '@/lib/query-keys';
import { tasksApi } from '../api/tasks.api';

type TaskPage = Paginated<TaskResponse>;

export function useTaskMutations(workspaceId: string) {
  const queryClient = useQueryClient();
  const tasksRoot = queryKeys.tasksRoot(workspaceId);
  const invalidate = () => queryClient.invalidateQueries({ queryKey: tasksRoot });

  const create = useMutation({
    mutationFn: ({ listId, body }: { listId: string; body: CreateTaskRequest }) => tasksApi.create(workspaceId, listId, body),
    onSuccess: invalidate,
    onError: (error) => toast.error(getErrorMessage(error)),
  });

  /** Optimistic: the row or card moves at once and rolls back if the server refuses. */
  const update = useMutation({
    mutationFn: ({ taskId, body }: { taskId: string; body: UpdateTaskRequest }) => tasksApi.update(workspaceId, taskId, body),
    onMutate: async ({ taskId, body }) => {
      await queryClient.cancelQueries({ queryKey: tasksRoot });
      const snapshot = queryClient.getQueriesData<TaskPage | TaskResponse>({ queryKey: tasksRoot });
      queryClient.setQueriesData<TaskPage | TaskResponse>({ queryKey: tasksRoot }, (data) => {
        if (!data) return data;
        if ('items' in data) {
          return { ...data, items: data.items.map((task) => (task.id === taskId ? applyPatch(task, body) : task)) };
        }
        return data.id === taskId ? applyPatch(data, body) : data;
      });
      return { snapshot };
    },
    onError: (error, _variables, context) => {
      context?.snapshot.forEach(([key, data]) => queryClient.setQueryData(key, data));
      toast.error(getErrorMessage(error));
    },
    onSettled: invalidate,
  });

  const remove = useMutation({
    mutationFn: (taskId: string) => tasksApi.remove(workspaceId, taskId),
    onSuccess: invalidate,
    onError: (error) => toast.error(getErrorMessage(error)),
  });

  return { create, update, remove };
}

function applyPatch(task: TaskResponse, body: UpdateTaskRequest): TaskResponse {
  const { title, description, status, priority, dueDate, assigneeId, position } = body;
  return {
    ...task,
    ...(title !== undefined && { title }),
    ...(description !== undefined && { description }),
    ...(status !== undefined && { status }),
    ...(priority !== undefined && { priority }),
    ...(dueDate !== undefined && { dueDate }),
    ...(assigneeId !== undefined && { assigneeId }),
    ...(position !== undefined && { position }),
  };
}
