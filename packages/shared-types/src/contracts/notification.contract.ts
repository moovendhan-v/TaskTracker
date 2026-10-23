import type { NotificationKind, RealtimeEntityType } from '../domain/notification.js';

export interface NotificationResponse {
  id: string;
  kind: NotificationKind;
  actorId: string | null;
  actorName: string | null;
  entityType: string;
  entityId: string;
  taskId: string | null;
  subject: string;
  excerpt: string;
  readAt: string | null;
  createdAt: string;
}

/** A change in a workspace, pushed over the WebSocket. Ids only: refetch to see content. */
export interface WorkspaceEventResponse {
  type: string;
  entityType: RealtimeEntityType;
  entityId: string;
  actorId: string;
  occurredAt: string;
}
