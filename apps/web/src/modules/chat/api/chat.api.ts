import type { ChatAttachmentResponse, ChatChannelKind, ChatSearchHit, ChatChannelResponse, ChatMemberRole, ChatMessagePage, ChatMessageResponse } from '@taskflow/shared-types';
import {
  AddChatChannelMembersDocument,
  ArchiveChatChannelDocument,
  BrowseChatChannelsDocument,
  ChatChannelDocument,
  ChatChannelMembersDocument,
  ChatChannelsDocument,
  ChatMessageDocument,
  ChatMessagesDocument,
  ChatThreadDocument,
  CreateChatChannelDocument,
  CreateTaskFromChatMessageDocument,
  DeleteChatMessageDocument,
  EditChatMessageDocument,
  JoinChatChannelDocument,
  LeaveChatChannelDocument,
  MarkChatChannelReadDocument,
  MuteChatChannelDocument,
  OpenDirectMessageDocument,
  RemoveChatChannelMemberDocument,
  SendChatMessageDocument,
  UpdateChatChannelDocument,
  ToggleChatReactionDocument,
  ChatTypingDocument,
  SearchChatMessagesDocument,
  RequestChatUploadDocument,
  CompleteChatUploadDocument,
  DiscardChatUploadDocument,
} from '@taskflow/sdk';
import { graphql } from '@/core/api/graphql-client';
import { uploadWith } from '@/lib/upload';

type RawChannel = Omit<ChatChannelResponse, 'kind' | 'myRole'> & { kind: string; myRole?: string | null };
type RawMessage = Omit<ChatMessageResponse, 'kind'> & { kind: string };

const channel = (raw: RawChannel): ChatChannelResponse => ({ ...raw, kind: raw.kind as ChatChannelKind, myRole: (raw.myRole ?? null) as ChatMemberRole | null });
const message = (raw: RawMessage): ChatMessageResponse => ({ ...raw, kind: raw.kind === 'system' ? 'system' : 'user' });
const page = (raw: { items: RawMessage[]; cursor?: string | null }): ChatMessagePage => ({ items: raw.items.map(message), cursor: raw.cursor ?? null });

export const chatApi = {
  channels: async (workspaceId: string) => (await graphql(ChatChannelsDocument, { workspaceId })).chatChannels.map(channel),
  browse: async (workspaceId: string, search: string | null) => (await graphql(BrowseChatChannelsDocument, { workspaceId, search, first: 50 })).browseChatChannels.map(channel),
  channel: async (workspaceId: string, channelId: string) => channel((await graphql(ChatChannelDocument, { workspaceId, channelId })).chatChannel),
  members: async (workspaceId: string, channelId: string) => (await graphql(ChatChannelMembersDocument, { workspaceId, channelId })).chatChannelMembers,
  messages: async (workspaceId: string, channelId: string, before: string | null) => page((await graphql(ChatMessagesDocument, { workspaceId, channelId, before, first: 50 })).chatMessages),
  message: async (workspaceId: string, messageId: string) => message((await graphql(ChatMessageDocument, { workspaceId, messageId })).chatMessage),
  thread: async (workspaceId: string, messageId: string) => page((await graphql(ChatThreadDocument, { workspaceId, messageId, first: 100 })).chatThread),
  createChannel: async (workspaceId: string, input: { name: string; topic?: string; kind: 'public' | 'private'; memberIds?: string[] }) =>
    channel((await graphql(CreateChatChannelDocument, { workspaceId, input })).createChatChannel),
  openDm: async (workspaceId: string, userIds: string[]) => channel((await graphql(OpenDirectMessageDocument, { workspaceId, userIds })).openDirectMessage),
  updateChannel: async (workspaceId: string, channelId: string, input: { name?: string; topic?: string }) =>
    channel((await graphql(UpdateChatChannelDocument, { workspaceId, channelId, input })).updateChatChannel),
  archive: async (workspaceId: string, channelId: string, archived: boolean) => channel((await graphql(ArchiveChatChannelDocument, { workspaceId, channelId, archived })).archiveChatChannel),
  join: async (workspaceId: string, channelId: string) => channel((await graphql(JoinChatChannelDocument, { workspaceId, channelId })).joinChatChannel),
  leave: async (workspaceId: string, channelId: string) => (await graphql(LeaveChatChannelDocument, { workspaceId, channelId })).leaveChatChannel,
  addMembers: async (workspaceId: string, channelId: string, userIds: string[]) => (await graphql(AddChatChannelMembersDocument, { workspaceId, channelId, userIds })).addChatChannelMembers,
  removeMember: async (workspaceId: string, channelId: string, userId: string) => (await graphql(RemoveChatChannelMemberDocument, { workspaceId, channelId, userId })).removeChatChannelMember,
  markRead: async (workspaceId: string, channelId: string, at: string) => (await graphql(MarkChatChannelReadDocument, { workspaceId, channelId, at })).markChatChannelRead,
  mute: async (workspaceId: string, channelId: string, muted: boolean) => (await graphql(MuteChatChannelDocument, { workspaceId, channelId, muted })).muteChatChannel,
  send: async (workspaceId: string, input: { channelId: string; body: string; parentId?: string | null; attachmentIds?: string[] }) => message((await graphql(SendChatMessageDocument, { workspaceId, input })).sendChatMessage),
  edit: async (workspaceId: string, messageId: string, body: string) => message((await graphql(EditChatMessageDocument, { workspaceId, messageId, body })).editChatMessage),
  remove: async (workspaceId: string, messageId: string) => (await graphql(DeleteChatMessageDocument, { workspaceId, messageId })).deleteChatMessage,
  react: async (workspaceId: string, messageId: string, emoji: string) => message((await graphql(ToggleChatReactionDocument, { workspaceId, messageId, emoji })).toggleChatReaction),
  typing: async (workspaceId: string, channelId: string) => (await graphql(ChatTypingDocument, { workspaceId, channelId })).chatTyping,
  search: async (workspaceId: string, query: string, channelId: string | null): Promise<ChatSearchHit[]> =>
    (await graphql(SearchChatMessagesDocument, { workspaceId, query, channelId, first: 30 })).searchChatMessages.map((hit) => ({
      message: message(hit.message),
      channelKind: hit.channelKind as ChatChannelKind,
      channelName: hit.channelName ?? null,
    })),
  createTask: async (workspaceId: string, input: { messageId: string; listId: string; title?: string }) =>
    message((await graphql(CreateTaskFromChatMessageDocument, { workspaceId, input })).createTaskFromChatMessage),
};

/** Uploads one file for a channel: ask for a link, send the bytes, then let the server check them. */
export function uploadChatFile(workspaceId: string, channelId: string, file: File, onProgress: (fraction: number) => void, signal?: AbortSignal): Promise<ChatAttachmentResponse> {
  return uploadWith<ChatAttachmentResponse>(
    {
      request: async () => (await graphql(RequestChatUploadDocument, { workspaceId, input: { channelId, fileName: file.name, size: file.size } })).requestChatUpload,
      complete: async (attachmentId) => (await graphql(CompleteChatUploadDocument, { workspaceId, attachmentId })).completeChatUpload,
      discard: (attachmentId) => graphql(DiscardChatUploadDocument, { workspaceId, attachmentId }),
    },
    file,
    onProgress,
    signal,
  );
}

export const discardChatFile = (workspaceId: string, attachmentId: string) => graphql(DiscardChatUploadDocument, { workspaceId, attachmentId }).then((data) => data.discardChatUpload);
