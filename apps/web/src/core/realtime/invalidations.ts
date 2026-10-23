import type { QueryKey } from '@tanstack/react-query';
import type { RealtimeEntityType } from '@taskflow/shared-types';
import { queryKeys } from '@/lib/query-keys';

/** The cached views a change to each kind of entity can affect. Prefix keys, so every variant refreshes. */
export function keysToRefresh(workspaceId: string, entityType: RealtimeEntityType): QueryKey[] {
  switch (entityType) {
    case 'task':
    case 'sprint':
      return [queryKeys.tasksRoot(workspaceId), queryKeys.sprintsRoot(workspaceId)];
    case 'comment':
      return [queryKeys.commentsRoot(workspaceId)];
    case 'document':
      return [queryKeys.documentsRoot(workspaceId)];
    case 'space':
      return [queryKeys.spaces(workspaceId), queryKeys.lists(workspaceId)];
    case 'list':
      return [queryKeys.lists(workspaceId)];
    case 'member':
      return [queryKeys.members(workspaceId), queryKeys.workspace(workspaceId), queryKeys.workspaces];
    case 'leave_request':
      return [queryKeys.hrRoot(workspaceId)];
    case 'notification':
      return [queryKeys.notificationsRoot(workspaceId)];
  }
}
