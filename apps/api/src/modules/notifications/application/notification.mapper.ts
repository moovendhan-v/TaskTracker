import type { NotificationResponse } from '@taskflow/shared-types';
import type { NotificationView } from '../domain/notification.js';

export const NotificationMapper = {
  toResponse(notification: NotificationView): NotificationResponse {
    return {
      id: notification.id,
      kind: notification.kind,
      actorId: notification.actorId,
      actorName: notification.actorName,
      entityType: notification.entityType,
      entityId: notification.entityId,
      taskId: notification.taskId,
      subject: notification.subject,
      excerpt: notification.excerpt,
      readAt: notification.readAt?.toISOString() ?? null,
      snoozedUntil: notification.snoozedUntil && notification.snoozedUntil > new Date() ? notification.snoozedUntil.toISOString() : null,
      createdAt: notification.createdAt.toISOString(),
    };
  },
};
