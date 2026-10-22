import type { CreateSpaceRequest, UpdateSpaceRequest } from '@taskflow/shared-types';
import { unwrap } from '@taskflow/sdk';
import { api } from '@/core/api/sdk-client';

export const spacesApi = {
  list: (workspaceId: string) => unwrap(api.GET('/api/workspaces/{workspaceId}/spaces', { params: { path: { workspaceId } } })),
  create: (workspaceId: string, body: CreateSpaceRequest) =>
    unwrap(api.POST('/api/workspaces/{workspaceId}/spaces', { params: { path: { workspaceId } }, body })),
  update: (workspaceId: string, spaceId: string, body: UpdateSpaceRequest) =>
    unwrap(api.PATCH('/api/workspaces/{workspaceId}/spaces/{spaceId}', { params: { path: { workspaceId, spaceId } }, body })),
  remove: (workspaceId: string, spaceId: string) =>
    unwrap(api.DELETE('/api/workspaces/{workspaceId}/spaces/{spaceId}', { params: { path: { workspaceId, spaceId } } })),
};
