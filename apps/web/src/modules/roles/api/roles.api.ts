import type { CreateRoleRequest, UpdateRoleRequest } from '@taskflow/shared-types';
import { unwrap } from '@taskflow/sdk';
import { api } from '@/core/api/sdk-client';

export const rolesApi = {
  list: (workspaceId: string) => unwrap(api.GET('/api/workspaces/{workspaceId}/roles', { params: { path: { workspaceId } } })),
  create: (workspaceId: string, body: CreateRoleRequest) =>
    unwrap(api.POST('/api/workspaces/{workspaceId}/roles', { params: { path: { workspaceId } }, body })),
  update: (workspaceId: string, roleId: string, body: UpdateRoleRequest) =>
    unwrap(api.PATCH('/api/workspaces/{workspaceId}/roles/{roleId}', { params: { path: { workspaceId, roleId } }, body })),
  remove: (workspaceId: string, roleId: string) =>
    unwrap(api.DELETE('/api/workspaces/{workspaceId}/roles/{roleId}', { params: { path: { workspaceId, roleId } } })),
};
