import type { CompleteSprintRequest, CreateSprintRequest, UpdateSprintRequest } from '@taskflow/shared-types';
import { unwrap } from '@taskflow/sdk';
import { api } from '@/core/api/sdk-client';

type SprintPath = { workspaceId: string; sprintId: string };
const sprintPath = (path: SprintPath) => ({ params: { path } });

export const sprintsApi = {
  listInSpace: (workspaceId: string, spaceId: string) =>
    unwrap(api.GET('/api/workspaces/{workspaceId}/spaces/{spaceId}/sprints', { params: { path: { workspaceId, spaceId } } })),
  get: (path: SprintPath) => unwrap(api.GET('/api/workspaces/{workspaceId}/sprints/{sprintId}', sprintPath(path))),
  create: (workspaceId: string, spaceId: string, body: CreateSprintRequest) =>
    unwrap(api.POST('/api/workspaces/{workspaceId}/spaces/{spaceId}/sprints', { params: { path: { workspaceId, spaceId } }, body })),
  update: (path: SprintPath, body: UpdateSprintRequest) =>
    unwrap(api.PATCH('/api/workspaces/{workspaceId}/sprints/{sprintId}', { ...sprintPath(path), body })),
  remove: (path: SprintPath) => unwrap(api.DELETE('/api/workspaces/{workspaceId}/sprints/{sprintId}', sprintPath(path))),
  start: (path: SprintPath) => unwrap(api.POST('/api/workspaces/{workspaceId}/sprints/{sprintId}/start', sprintPath(path))),
  complete: (path: SprintPath, body: CompleteSprintRequest) =>
    unwrap(api.POST('/api/workspaces/{workspaceId}/sprints/{sprintId}/complete', { ...sprintPath(path), body })),
  tasks: (path: SprintPath) => unwrap(api.GET('/api/workspaces/{workspaceId}/sprints/{sprintId}/tasks', sprintPath(path))),
  backlog: (workspaceId: string, spaceId: string) =>
    unwrap(api.GET('/api/workspaces/{workspaceId}/spaces/{spaceId}/backlog', { params: { path: { workspaceId, spaceId } } })),
};
