import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '@/lib/query-keys';
import { inboxApi, type InboxView } from '../api/inbox.api';

export function useNotifications(workspaceId: string, view: InboxView | boolean) {
  const filter: InboxView = typeof view === 'boolean' ? { unreadOnly: view } : view;
  return useQuery({
    queryKey: queryKeys.notifications(workspaceId, filter),
    queryFn: () => inboxApi.list(workspaceId, filter),
    placeholderData: (previous) => previous,
    // Snoozed items come back on their own; a minute's lag is fine.
    refetchInterval: 60_000,
  });
}

/** Kept fresh by live events; refetching on focus covers a dropped connection. */
export function useUnreadCount(workspaceId: string) {
  return useQuery({ queryKey: queryKeys.unreadNotifications(workspaceId), queryFn: () => inboxApi.unreadCount(workspaceId) });
}

export function useInboxMutations(workspaceId: string) {
  const queryClient = useQueryClient();
  const refresh = () => queryClient.invalidateQueries({ queryKey: queryKeys.notificationsRoot(workspaceId) });
  return {
    markRead: useMutation({ mutationFn: (ids: string[]) => inboxApi.markRead(workspaceId, ids), onSuccess: refresh }),
    markAllRead: useMutation({ mutationFn: () => inboxApi.markAllRead(workspaceId), onSuccess: refresh }),
    snooze: useMutation({ mutationFn: ({ ids, until }: { ids: string[]; until: Date | null }) => inboxApi.snooze(workspaceId, ids, until), onSuccess: refresh }),
  };
}
