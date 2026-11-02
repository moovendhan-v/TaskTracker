import type { QueryKey } from '@tanstack/react-query';
import type { RealtimeEntityType } from '@taskflow/shared-types';
import { queryKeys } from '@/lib/query-keys';

/** The cached views a change to each kind of entity can affect. Prefix keys, so every variant refreshes. */
export function keysToRefresh(workspaceId: string, entityType: RealtimeEntityType): QueryKey[] {
  switch (entityType) {
    case 'task':
    case 'sprint':
      return [queryKeys.tasksRoot(workspaceId), queryKeys.sprintsRoot(workspaceId), queryKeys.dashboardRoot(workspaceId)];
    case 'comment':
      return [queryKeys.commentsRoot(workspaceId)];
    case 'document':
      return [queryKeys.documentsRoot(workspaceId)];
    case 'space':
      return [queryKeys.spaces(workspaceId), queryKeys.lists(workspaceId)];
    case 'list':
    case 'folder':
      return [queryKeys.lists(workspaceId)];
    case 'member':
      return [queryKeys.members(workspaceId), queryKeys.workspace(workspaceId), queryKeys.workspaces];
    case 'leave_request':
      return [queryKeys.hrRoot(workspaceId)];
    case 'notification':
      return [queryKeys.notificationsRoot(workspaceId)];
    case 'role':
    case 'policy':
      return [queryKeys.roles(workspaceId), queryKeys.members(workspaceId), queryKeys.workspace(workspaceId)];
    case 'workspace':
      return [queryKeys.workspace(workspaceId), queryKeys.workspaces];
    case 'department':
    case 'employee':
    case 'leave_type':
      return [queryKeys.hrRoot(workspaceId)];
    case 'status':
    case 'custom_field':
      return [queryKeys.tasksRoot(workspaceId), queryKeys.spaces(workspaceId)];
    case 'integration':
      return [queryKeys.integrations(workspaceId)];
    case 'automation':
      return [queryKeys.automationsRoot(workspaceId)];
    case 'time_entry':
      return [queryKeys.timeRoot(workspaceId), queryKeys.dashboardRoot(workspaceId)];
    case 'chat_channel':
    case 'chat_message':
      return [queryKeys.chatRoot(workspaceId)];
  }
}
