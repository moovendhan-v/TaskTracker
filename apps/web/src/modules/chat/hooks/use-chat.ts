import { useInfiniteQuery, useMutation, useQuery, useQueryClient, type InfiniteData } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { CHAT_TYPING_TTL_MS } from '@taskflow/shared-types';
import { liveEvents } from '@/core/realtime/live-events';
import type { ChatMessagePage, ChatMessageResponse } from '@taskflow/shared-types';
import { queryKeys } from '@/lib/query-keys';
import { chatApi } from '../api/chat.api';

export const chatKeys = {
  channels: (workspaceId: string) => [...queryKeys.chatRoot(workspaceId), 'channels'] as const,
  search: (workspaceId: string, query: string) => [...queryKeys.chatRoot(workspaceId), 'search', query] as const,
  browse: (workspaceId: string, search: string) => [...queryKeys.chatRoot(workspaceId), 'browse', search] as const,
  channel: (workspaceId: string, channelId: string) => [...queryKeys.chatRoot(workspaceId), 'channel', channelId] as const,
  members: (workspaceId: string, channelId: string) => [...queryKeys.chatRoot(workspaceId), 'members', channelId] as const,
  messages: (workspaceId: string, channelId: string) => [...queryKeys.chatRoot(workspaceId), 'messages', channelId] as const,
  message: (workspaceId: string, messageId: string) => [...queryKeys.chatRoot(workspaceId), 'message', messageId] as const,
  thread: (workspaceId: string, messageId: string) => [...queryKeys.chatRoot(workspaceId), 'thread', messageId] as const,
  retention: (workspaceId: string) => [...queryKeys.chatRoot(workspaceId), 'retention'] as const,
};

export function useChatChannels(workspaceId: string, enabled = true) {
  return useQuery({ queryKey: chatKeys.channels(workspaceId), queryFn: () => chatApi.channels(workspaceId), enabled, staleTime: 15_000 });
}

/** Unread top-level messages across your unmuted channels, for the rail and side panel. */
export function useChatUnread(workspaceId: string, enabled: boolean): number {
  const { data = [] } = useChatChannels(workspaceId, enabled);
  return data.reduce((sum, channel) => sum + (channel.muted ? 0 : channel.unreadCount), 0);
}

export function useBrowseChannels(workspaceId: string, search: string, enabled: boolean) {
  return useQuery({ queryKey: chatKeys.browse(workspaceId, search), queryFn: () => chatApi.browse(workspaceId, search.trim() || null), enabled });
}

export function useChatChannel(workspaceId: string, channelId: string | undefined) {
  return useQuery({ queryKey: chatKeys.channel(workspaceId, channelId ?? ''), queryFn: () => chatApi.channel(workspaceId, channelId!), enabled: Boolean(channelId), retry: false });
}

export function useChatMembers(workspaceId: string, channelId: string, enabled: boolean) {
  return useQuery({ queryKey: chatKeys.members(workspaceId, channelId), queryFn: () => chatApi.members(workspaceId, channelId), enabled });
}

/** Top-level messages, oldest first, with older pages loaded on demand. */
export function useChatMessages(workspaceId: string, channelId: string) {
  const query = useInfiniteQuery({
    queryKey: chatKeys.messages(workspaceId, channelId),
    queryFn: ({ pageParam }) => chatApi.messages(workspaceId, channelId, pageParam),
    initialPageParam: null as string | null,
    getNextPageParam: (last) => last.cursor,
    retry: false,
  });
  const messages = (query.data?.pages ?? []).flatMap((page) => page.items).reverse();
  return { ...query, messages };
}

export function useChatMessage(workspaceId: string, messageId: string | undefined) {
  return useQuery({ queryKey: chatKeys.message(workspaceId, messageId ?? ''), queryFn: () => chatApi.message(workspaceId, messageId!), enabled: Boolean(messageId), retry: false });
}

export function useChatThread(workspaceId: string, messageId: string | undefined) {
  return useQuery({ queryKey: chatKeys.thread(workspaceId, messageId ?? ''), queryFn: () => chatApi.thread(workspaceId, messageId!), enabled: Boolean(messageId), retry: false });
}

export function useChatMutations(workspaceId: string) {
  const queryClient = useQueryClient();
  const refresh = () => queryClient.invalidateQueries({ queryKey: queryKeys.chatRoot(workspaceId) });

  /** Shows your message straight away; the refetch that follows brings in anything else. */
  const placeSent = (message: ChatMessageResponse) => {
    if (message.parentId) {
      queryClient.setQueryData<ChatMessagePage>(chatKeys.thread(workspaceId, message.parentId), (page) =>
        page ? { ...page, items: [...page.items.filter((item) => item.id !== message.id), message] } : page,
      );
      return;
    }
    queryClient.setQueryData<InfiniteData<ChatMessagePage, string | null>>(chatKeys.messages(workspaceId, message.channelId), (data) =>
      data && data.pages[0]
        ? { ...data, pages: [{ ...data.pages[0], items: [message, ...data.pages[0].items.filter((item) => item.id !== message.id)] }, ...data.pages.slice(1)] }
        : data,
    );
  };

  const settle = { onSettled: refresh };
  return {
    send: useMutation({ mutationFn: (input: { channelId: string; body: string; parentId?: string | null; attachmentIds?: string[] }) => chatApi.send(workspaceId, input), onSuccess: placeSent, ...settle }),
    edit: useMutation({ mutationFn: ({ messageId, body }: { messageId: string; body: string }) => chatApi.edit(workspaceId, messageId, body), ...settle }),
    remove: useMutation({ mutationFn: (messageId: string) => chatApi.remove(workspaceId, messageId), ...settle }),
    createChannel: useMutation({ mutationFn: (input: Parameters<typeof chatApi.createChannel>[1]) => chatApi.createChannel(workspaceId, input), ...settle }),
    openDm: useMutation({ mutationFn: (userIds: string[]) => chatApi.openDm(workspaceId, userIds), ...settle }),
    updateChannel: useMutation({
      mutationFn: ({ channelId, ...input }: { channelId: string; name?: string; topic?: string }) => chatApi.updateChannel(workspaceId, channelId, input),
      ...settle,
    }),
    archive: useMutation({ mutationFn: ({ channelId, archived }: { channelId: string; archived: boolean }) => chatApi.archive(workspaceId, channelId, archived), ...settle }),
    join: useMutation({ mutationFn: (channelId: string) => chatApi.join(workspaceId, channelId), ...settle }),
    leave: useMutation({ mutationFn: (channelId: string) => chatApi.leave(workspaceId, channelId), ...settle }),
    addMembers: useMutation({ mutationFn: ({ channelId, userIds }: { channelId: string; userIds: string[] }) => chatApi.addMembers(workspaceId, channelId, userIds), ...settle }),
    removeMember: useMutation({ mutationFn: ({ channelId, userId }: { channelId: string; userId: string }) => chatApi.removeMember(workspaceId, channelId, userId), ...settle }),
    mute: useMutation({ mutationFn: ({ channelId, muted }: { channelId: string; muted: boolean }) => chatApi.mute(workspaceId, channelId, muted), ...settle }),
    markRead: useMutation({
      mutationFn: ({ channelId, at }: { channelId: string; at: string }) => chatApi.markRead(workspaceId, channelId, at),
      onSuccess: () => queryClient.invalidateQueries({ queryKey: chatKeys.channels(workspaceId) }),
    }),
    react: useMutation({ mutationFn: ({ messageId, emoji }: { messageId: string; emoji: string }) => chatApi.react(workspaceId, messageId, emoji), ...settle }),
    createTask: useMutation({ mutationFn: (input: { messageId: string; listId: string; title?: string }) => chatApi.createTask(workspaceId, input), onSuccess: placeSent, ...settle }),
  };
}

/** Who else is typing in a channel right now (user ids), from live "typing" signals. */
export function useTypingIn(workspaceId: string, channelId: string, me: string): string[] {
  const [typing, setTyping] = useState<Record<string, number>>({});
  useEffect(
    () =>
      liveEvents.listen((eventWorkspace, event) => {
        if (eventWorkspace !== workspaceId || event.type !== 'chat_typing.updated' || event.entityId !== channelId || event.actorId === me) return;
        setTyping((current) => ({ ...current, [event.actorId]: Date.now() + CHAT_TYPING_TTL_MS }));
      }),
    [workspaceId, channelId, me],
  );
  // A new message from someone means they stopped typing.
  useEffect(
    () =>
      liveEvents.listen((eventWorkspace, event) => {
        if (eventWorkspace !== workspaceId || event.type !== 'chat_message.created') return;
        setTyping((current) => {
          if (!(event.actorId in current)) return current;
          const { [event.actorId]: _gone, ...rest } = current;
          return rest;
        });
      }),
    [workspaceId],
  );
  const active = Object.keys(typing).length > 0;
  useEffect(() => {
    if (!active) return;
    const timer = setInterval(() => {
      setTyping((current) => {
        const now = Date.now();
        const live = Object.fromEntries(Object.entries(current).filter(([, until]) => until > now));
        return Object.keys(live).length === Object.keys(current).length ? current : live;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [active]);
  return Object.keys(typing);
}

/** Message search; waits until there is something to search for. */
export function useChatSearch(workspaceId: string, query: string) {
  const trimmed = query.trim();
  return useQuery({
    queryKey: chatKeys.search(workspaceId, trimmed),
    queryFn: () => chatApi.search(workspaceId, trimmed, null),
    enabled: trimmed.length >= 2,
    staleTime: 10_000,
    placeholderData: (previous) => previous,
  });
}

/** How long the workspace keeps chat, in days (null: forever). */
export function useChatRetention(workspaceId: string, enabled = true) {
  return useQuery({ queryKey: chatKeys.retention(workspaceId), queryFn: () => chatApi.retention(workspaceId), enabled, staleTime: 5 * 60_000 });
}
