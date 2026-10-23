import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '@/lib/query-keys';
import { inboxApi } from '../api/inbox.api';

export function useNotifications(workspaceId: string, unreadOnly: boolean) {
  return useQuery({
    queryKey: queryKeys.notifications(workspaceId, unreadOnly),
    queryFn: () => inboxApi.list(workspaceId, unreadOnly),
    placeholderData: (previous) => previous,
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
  };
}
