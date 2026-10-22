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
  // Sprint task lists and the backlog live under tasksRoot, so any task change refreshes them.
  sprintTasks: (workspaceId: string, sprintId: string) => ['workspaces', workspaceId, 'tasks', 'sprint', sprintId] as const,
  backlog: (workspaceId: string, spaceId: string) => ['workspaces', workspaceId, 'tasks', 'backlog', spaceId] as const,
  sprintsRoot: (workspaceId: string) => ['workspaces', workspaceId, 'sprints'] as const,
  sprints: (workspaceId: string, spaceId: string) => ['workspaces', workspaceId, 'sprints', 'space', spaceId] as const,
  sprint: (workspaceId: string, sprintId: string) => ['workspaces', workspaceId, 'sprints', 'detail', sprintId] as const,
  documentsRoot: (workspaceId: string) => ['workspaces', workspaceId, 'documents'] as const,
  documentTree: (workspaceId: string, search = '') => ['workspaces', workspaceId, 'documents', 'tree', search] as const,
  document: (workspaceId: string, documentId: string) => ['workspaces', workspaceId, 'documents', 'detail', documentId] as const,
  hrRoot: (workspaceId: string) => ['workspaces', workspaceId, 'hr'] as const,
  departments: (workspaceId: string) => ['workspaces', workspaceId, 'hr', 'departments'] as const,
  employees: (workspaceId: string) => ['workspaces', workspaceId, 'hr', 'employees'] as const,
  leaveTypes: (workspaceId: string) => ['workspaces', workspaceId, 'hr', 'leave-types'] as const,
  myLeave: (workspaceId: string) => ['workspaces', workspaceId, 'hr', 'leave', 'mine'] as const,
  leaveQueue: (workspaceId: string, status: string) => ['workspaces', workspaceId, 'hr', 'leave', 'queue', status] as const,
  myBalances: (workspaceId: string, year: number) => ['workspaces', workspaceId, 'hr', 'leave', 'balances', year] as const,
};
