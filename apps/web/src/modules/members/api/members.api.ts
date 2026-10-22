import type { AddMemberRequest, UpdateMemberRoleRequest } from '@taskflow/shared-types';
import { unwrap } from '@taskflow/sdk';
import { api } from '@/core/api/sdk-client';

export const membersApi = {
  list: (workspaceId: string) => unwrap(api.GET('/api/workspaces/{workspaceId}/members', { params: { path: { workspaceId } } })),
  add: (workspaceId: string, body: AddMemberRequest) =>
    unwrap(api.POST('/api/workspaces/{workspaceId}/members', { params: { path: { workspaceId } }, body })),
  updateRole: (workspaceId: string, userId: string, body: UpdateMemberRoleRequest) =>
    unwrap(api.PATCH('/api/workspaces/{workspaceId}/members/{userId}', { params: { path: { workspaceId, userId } }, body })),
  remove: (workspaceId: string, userId: string) =>
    unwrap(api.DELETE('/api/workspaces/{workspaceId}/members/{userId}', { params: { path: { workspaceId, userId } } })),
  leave: (workspaceId: string) => unwrap(api.POST('/api/workspaces/{workspaceId}/members/leave', { params: { path: { workspaceId } } })),
};
