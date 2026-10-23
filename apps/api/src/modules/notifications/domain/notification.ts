import type { NotificationKind } from '@taskflow/shared-types';

export type { NotificationKind };

export interface Notification {
  id: string;
  workspaceId: string;
  recipientId: string;
  actorId: string | null;
  kind: NotificationKind;
  entityType: string;
  entityId: string;
  /** The task to open, when the notification is about one. */
  taskId: string | null;
  /** What it's about, e.g. the task title, snapshotted when sent. */
  subject: string;
  /** A short plain-text quote, e.g. the start of a comment. */
  excerpt: string;
  readAt: Date | null;
  createdAt: Date;
}

export type NewNotification = Omit<Notification, 'id' | 'readAt' | 'createdAt'>;

/** A notification with the actor's display name, for the inbox. */
export interface NotificationView extends Notification {
  actorName: string | null;
}
