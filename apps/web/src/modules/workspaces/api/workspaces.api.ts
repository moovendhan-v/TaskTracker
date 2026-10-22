import type { CreateWorkspaceRequest, UpdateWorkspaceRequest } from '@taskflow/shared-types';
import { unwrap } from '@taskflow/sdk';
import { api } from '@/core/api/sdk-client';

const path = (workspaceId: string) => ({ params: { path: { workspaceId } } });

export const workspacesApi = {
  list: () => unwrap(api.GET('/api/workspaces')),
  get: (workspaceId: string) => unwrap(api.GET('/api/workspaces/{workspaceId}', path(workspaceId))),
  create: (body: CreateWorkspaceRequest) => unwrap(api.POST('/api/workspaces', { body })),
  update: (workspaceId: string, body: UpdateWorkspaceRequest) =>
    unwrap(api.PATCH('/api/workspaces/{workspaceId}', { ...path(workspaceId), body })),
  remove: (workspaceId: string) => unwrap(api.DELETE('/api/workspaces/{workspaceId}', path(workspaceId))),
};
