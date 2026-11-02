import type { ChatChannelKind, ChatMemberRole } from '@taskflow/shared-types';

export interface ChatChannelRecord {
  id: string;
  workspaceId: string;
  kind: ChatChannelKind;
  name: string | null;
  topic: string;
  createdBy: string | null;
  archivedAt: Date | null;
  createdAt: Date;
  /** The caller's membership, if any. */
  myRole: ChatMemberRole | null;
  muted: boolean;
  memberCount: number;
  unreadCount: number;
  lastMessageAt: Date | null;
}

export interface ChatPersonRecord {
  id: string;
  name: string;
}

export interface ChatMemberRecord {
  userId: string;
  name: string;
  role: ChatMemberRole;
  joinedAt: Date;
}

export interface ChatMessageRecord {
  id: string;
  channelId: string;
  parentId: string | null;
  authorId: string | null;
  authorName: string | null;
  kind: 'user' | 'system';
  body: string;
  taskId: string | null;
  replyCount: number;
  lastReplyAt: Date | null;
  editedAt: Date | null;
  deletedAt: Date | null;
  createdAt: Date;
  /** Opaque position for keyset paging. */
  position: { at: string; id: string };
}

export interface MessagePosition {
  at: string;
  id: string;
}

/**
 * Chat storage. Every method takes the workspace and runs under row-level
 * security, so a channel or message the caller can't read is simply not found.
 */
export abstract class ChatRepository {
  abstract listMyChannels(workspaceId: string, userId: string): Promise<ChatChannelRecord[]>;
  abstract browsePublic(workspaceId: string, userId: string, search: string | null, limit: number): Promise<ChatChannelRecord[]>;
  abstract findChannel(workspaceId: string, userId: string, channelId: string): Promise<ChatChannelRecord | null>;
  abstract findDm(workspaceId: string, userId: string, dmKey: string): Promise<ChatChannelRecord | null>;
  abstract nameTaken(workspaceId: string, name: string, exceptId: string | null): Promise<boolean>;
  abstract insertChannel(input: { workspaceId: string; kind: ChatChannelKind; name: string | null; topic: string; dmKey: string | null; createdBy: string }): Promise<string>;
  abstract updateChannel(workspaceId: string, channelId: string, changes: { name?: string; topic?: string; archived?: boolean }): Promise<boolean>;

  abstract dmPeople(workspaceId: string, channelIds: string[], exceptUserId: string): Promise<Map<string, ChatPersonRecord[]>>;
  abstract listMembers(workspaceId: string, channelId: string, limit: number): Promise<ChatMemberRecord[]>;
  abstract memberIds(workspaceId: string, channelId: string): Promise<string[]>;
  abstract memberRole(workspaceId: string, channelId: string, userId: string): Promise<ChatMemberRole | null>;
  abstract countMembers(workspaceId: string, channelId: string): Promise<{ total: number; owners: number }>;
  abstract addMembers(workspaceId: string, channelId: string, members: { userId: string; role: ChatMemberRole }[]): Promise<number>;
  abstract removeMember(workspaceId: string, channelId: string, userId: string): Promise<boolean>;
  abstract setMemberRole(workspaceId: string, channelId: string, userId: string, role: ChatMemberRole): Promise<boolean>;
  abstract markRead(workspaceId: string, channelId: string, userId: string, at: Date): Promise<boolean>;
  abstract setMuted(workspaceId: string, channelId: string, userId: string, muted: boolean): Promise<boolean>;
  /** Names of workspace members among `userIds`. */
  abstract memberNames(workspaceId: string, userIds: string[]): Promise<Map<string, string>>;
  /** Which of these users belong to the workspace. */
  abstract workspaceMembers(workspaceId: string, userIds: string[]): Promise<string[]>;

  abstract insertMessage(input: { workspaceId: string; channelId: string; authorId: string; body: string; parentId: string | null; kind: 'user' | 'system'; taskId: string | null }): Promise<string>;
  abstract findMessage(workspaceId: string, messageId: string): Promise<ChatMessageRecord | null>;
  abstract editMessage(workspaceId: string, messageId: string, authorId: string, body: string): Promise<boolean>;
  abstract deleteMessage(workspaceId: string, messageId: string, authorId: string): Promise<boolean>;
  /** Top-level messages, newest first, before `before` when given. */
  abstract listChannelMessages(workspaceId: string, channelId: string, before: MessagePosition | null, limit: number): Promise<ChatMessageRecord[]>;
  /** Replies to a root, oldest first, after `after` when given. */
  abstract listThread(workspaceId: string, rootId: string, after: MessagePosition | null, limit: number): Promise<ChatMessageRecord[]>;
}
