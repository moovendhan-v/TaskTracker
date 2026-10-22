import type { CreateCommentRequest, UpdateCommentRequest } from '@taskflow/shared-types';
import { unwrap } from '@taskflow/sdk';
import { api } from '@/core/api/sdk-client';

export const commentsApi = {
  list: (workspaceId: string, taskId: string) =>
    unwrap(api.GET('/api/workspaces/{workspaceId}/tasks/{taskId}/comments', { params: { path: { workspaceId, taskId } } })),
  create: (workspaceId: string, taskId: string, body: CreateCommentRequest) =>
    unwrap(api.POST('/api/workspaces/{workspaceId}/tasks/{taskId}/comments', { params: { path: { workspaceId, taskId } }, body })),
  update: (workspaceId: string, commentId: string, body: UpdateCommentRequest) =>
    unwrap(api.PATCH('/api/workspaces/{workspaceId}/comments/{commentId}', { params: { path: { workspaceId, commentId } }, body })),
  remove: (workspaceId: string, commentId: string) =>
    unwrap(api.DELETE('/api/workspaces/{workspaceId}/comments/{commentId}', { params: { path: { workspaceId, commentId } } })),
};
