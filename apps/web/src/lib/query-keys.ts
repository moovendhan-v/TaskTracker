import type { TaskQuery } from '@taskflow/shared-types';

/** Every TanStack Query key in one place, so invalidation never misses a typo'd key. */
export const queryKeys = {
  me: ['me'] as const,
  workspaces: ['workspaces'] as const,
  workspace: (workspaceId: string) => ['workspaces', workspaceId] as const,
  members: (workspaceId: string) => ['workspaces', workspaceId, 'members'] as const,
  roles: (workspaceId: string) => ['workspaces', workspaceId, 'roles'] as const,
  spaces: (workspaceId: string) => ['workspaces', workspaceId, 'spaces'] as const,
  lists: (workspaceId: string) => ['workspaces', workspaceId, 'lists'] as const,
  tasksRoot: (workspaceId: string) => ['workspaces', workspaceId, 'tasks'] as const,
  tasks: (workspaceId: string, listId: string, query: TaskQuery = {}) =>
    ['workspaces', workspaceId, 'tasks', 'list', listId, query] as const,
  task: (workspaceId: string, taskId: string) => ['workspaces', workspaceId, 'tasks', 'detail', taskId] as const,
  comments: (workspaceId: string, taskId: string) => ['workspaces', workspaceId, 'comments', taskId] as const,
};
