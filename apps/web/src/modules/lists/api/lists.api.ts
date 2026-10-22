import type { CreateTaskListRequest, UpdateTaskListRequest } from '@taskflow/shared-types';
import { unwrap } from '@taskflow/sdk';
import { api } from '@/core/api/sdk-client';

export const listsApi = {
  list: (workspaceId: string) => unwrap(api.GET('/api/workspaces/{workspaceId}/lists', { params: { path: { workspaceId } } })),
  create: (workspaceId: string, spaceId: string, body: CreateTaskListRequest) =>
    unwrap(api.POST('/api/workspaces/{workspaceId}/spaces/{spaceId}/lists', { params: { path: { workspaceId, spaceId } }, body })),
  update: (workspaceId: string, listId: string, body: UpdateTaskListRequest) =>
    unwrap(api.PATCH('/api/workspaces/{workspaceId}/lists/{listId}', { params: { path: { workspaceId, listId } }, body })),
  remove: (workspaceId: string, listId: string) =>
    unwrap(api.DELETE('/api/workspaces/{workspaceId}/lists/{listId}', { params: { path: { workspaceId, listId } } })),
};
