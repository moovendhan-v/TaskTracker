import type { PageRequest } from '../../../core/domain/page-request.js';
import type { NewNotification, Notification, NotificationKind, NotificationView } from './notification.js';

export interface InboxFilter {
  unreadOnly: boolean;
  /** Only these kinds; all when absent. */
  kinds?: readonly NotificationKind[];
  /** The snoozed items (soonest back first) instead of the inbox. */
  snoozed?: boolean;
}

/** Every method is limited to one recipient in one workspace. */
export abstract class NotificationRepository {
  abstract create(notification: NewNotification): Promise<Notification>;
  abstract page(workspaceId: string, recipientId: string, filter: InboxFilter, now: Date, page: PageRequest): Promise<{ items: NotificationView[]; total: number }>;
  /** Unread items in the inbox now (snoozed ones don't count until they're back). */
  abstract countUnread(workspaceId: string, recipientId: string, now: Date): Promise<number>;
  /** Snoozes until `until` (and marks unread, so they come back as new), or unsnoozes with null. Returns how many changed. */
  abstract snooze(workspaceId: string, recipientId: string, ids: readonly string[], until: Date | null): Promise<number>;
  /** Marks the given notifications read (all unread ones when `ids` is null). Returns how many changed. */
  abstract markRead(workspaceId: string, recipientId: string, ids: readonly string[] | null, at: Date): Promise<number>;
}
