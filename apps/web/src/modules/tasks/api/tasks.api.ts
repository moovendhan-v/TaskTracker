import type { CreateTaskRequest, TaskQuery, UpdateTaskRequest } from '@taskflow/shared-types';
import { unwrap } from '@taskflow/sdk';
import { api } from '@/core/api/sdk-client';

export const tasksApi = {
  listInList: (workspaceId: string, listId: string, query: TaskQuery) =>
    unwrap(api.GET('/api/workspaces/{workspaceId}/lists/{listId}/tasks', { params: { path: { workspaceId, listId }, query } })),
  get: (workspaceId: string, taskId: string) =>
    unwrap(api.GET('/api/workspaces/{workspaceId}/tasks/{taskId}', { params: { path: { workspaceId, taskId } } })),
  create: (workspaceId: string, listId: string, body: CreateTaskRequest) =>
    unwrap(api.POST('/api/workspaces/{workspaceId}/lists/{listId}/tasks', { params: { path: { workspaceId, listId } }, body })),
  update: (workspaceId: string, taskId: string, body: UpdateTaskRequest) =>
    unwrap(api.PATCH('/api/workspaces/{workspaceId}/tasks/{taskId}', { params: { path: { workspaceId, taskId } }, body })),
  remove: (workspaceId: string, taskId: string) =>
    unwrap(api.DELETE('/api/workspaces/{workspaceId}/tasks/{taskId}', { params: { path: { workspaceId, taskId } } })),
};
