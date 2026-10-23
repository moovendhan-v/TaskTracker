import type { PageRequest } from '../../../core/domain/page-request.js';
import type { NewNotification, Notification, NotificationView } from './notification.js';

export interface InboxFilter {
  unreadOnly: boolean;
}

/** Every method is limited to one recipient in one workspace. */
export abstract class NotificationRepository {
  abstract create(notification: NewNotification): Promise<Notification>;
  abstract page(workspaceId: string, recipientId: string, filter: InboxFilter, page: PageRequest): Promise<{ items: NotificationView[]; total: number }>;
  abstract countUnread(workspaceId: string, recipientId: string): Promise<number>;
  /** Marks the given notifications read (all unread ones when `ids` is null). Returns how many changed. */
  abstract markRead(workspaceId: string, recipientId: string, ids: readonly string[] | null, at: Date): Promise<number>;
}
