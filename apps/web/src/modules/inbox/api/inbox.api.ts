import {
  MarkAllNotificationsReadDocument,
  MarkNotificationsReadDocument,
  NotificationsDocument,
  UnreadNotificationCountDocument,
} from '@taskflow/sdk';
import { graphql } from '@/core/api/graphql-client';

/** The inbox shows one page of this size. */
export const INBOX_PAGE_SIZE = 50;

export const inboxApi = {
  list: async (workspaceId: string, unreadOnly: boolean) =>
    (await graphql(NotificationsDocument, { workspaceId, unreadOnly, pageSize: INBOX_PAGE_SIZE })).notifications,
  unreadCount: async (workspaceId: string) => (await graphql(UnreadNotificationCountDocument, { workspaceId })).unreadNotificationCount,
  markRead: async (workspaceId: string, ids: string[]) => (await graphql(MarkNotificationsReadDocument, { workspaceId, ids })).markNotificationsRead,
  markAllRead: async (workspaceId: string) => (await graphql(MarkAllNotificationsReadDocument, { workspaceId })).markAllNotificationsRead,
};
