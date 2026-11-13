import {
  MarkAllNotificationsReadDocument,
  MarkNotificationsReadDocument,
  NotificationsDocument,
  SnoozeNotificationsDocument,
  UnreadNotificationCountDocument,
} from '@taskflow/sdk';
import type { NotificationKind } from '@taskflow/shared-types';
import { graphql } from '@/core/api/graphql-client';

/** Which notifications a view shows. */
export interface InboxView {
  unreadOnly: boolean;
  kinds?: readonly NotificationKind[] | null;
  snoozed?: boolean;
}

/** The inbox shows one page of this size. */
export const INBOX_PAGE_SIZE = 50;

export const inboxApi = {
  list: async (workspaceId: string, view: InboxView) =>
    (await graphql(NotificationsDocument, { workspaceId, unreadOnly: view.unreadOnly, kinds: view.kinds ? [...view.kinds] : null, snoozed: view.snoozed ?? false, pageSize: INBOX_PAGE_SIZE })).notifications,
  /** Until a time (they come back unread then), or null to bring them back now. */
  snooze: async (workspaceId: string, ids: string[], until: Date | null) => (await graphql(SnoozeNotificationsDocument, { workspaceId, ids, until: until?.toISOString() ?? null })).snoozeNotifications,
  unreadCount: async (workspaceId: string) => (await graphql(UnreadNotificationCountDocument, { workspaceId })).unreadNotificationCount,
  markRead: async (workspaceId: string, ids: string[]) => (await graphql(MarkNotificationsReadDocument, { workspaceId, ids })).markNotificationsRead,
  markAllRead: async (workspaceId: string) => (await graphql(MarkAllNotificationsReadDocument, { workspaceId })).markAllNotificationsRead,
};
