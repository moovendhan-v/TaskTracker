import type { ChatChannelKind, ChatMemberRole, ChatReactionSummary } from '@taskflow/shared-types';

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

export interface ChatAttachmentRecord {
  id: string;
  channelId: string;
  uploaderId: string;
  messageId: string | null;
  fileName: string;
  contentType: string | null;
  declaredSize: number;
  size: number | null;
  storageKey: string;
  /** An image preview is stored at `<storageKey>-thumb`. */
  hasThumbnail: boolean;
  status: 'pending' | 'ready';
  createdAt: Date;
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
  /** A public channel's id by name (office meeting rooms, D3). */
  abstract findPublicByName(workspaceId: string, name: string): Promise<string | null>;
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

  /** Reactions per message, grouped by emoji, in the order they were first used. */
  abstract reactionsFor(workspaceId: string, messageIds: string[], userId: string): Promise<Map<string, ChatReactionSummary[]>>;
  /** Adds your reaction, or removes it if you already reacted with that emoji. Returns whether it is on now. */
  abstract toggleReaction(input: { workspaceId: string; channelId: string; messageId: string; userId: string; emoji: string }): Promise<boolean>;

  /** Messages that mention task #number (a chip or a card) or record its creation, newest first, in channels the caller can read. */
  abstract messagesAboutTask(workspaceId: string, taskId: string, number: number, limit: number): Promise<{ record: ChatMessageRecord; channelKind: ChatChannelKind; channelName: string | null }[]>;
  /** Messages matching a tsquery (already built from safe terms), newest first, in channels the caller can read. */
  abstract searchMessages(workspaceId: string, tsquery: string, channelId: string | null, limit: number): Promise<{ record: ChatMessageRecord; channelKind: ChatChannelKind; channelName: string | null }[]>;

  abstract insertAttachment(input: { workspaceId: string; channelId: string; uploaderId: string; fileName: string; declaredSize: number; storageKey: string }): Promise<string>;
  abstract findAttachment(workspaceId: string, id: string): Promise<ChatAttachmentRecord | null>;
  abstract markAttachmentReady(workspaceId: string, id: string, contentType: string, size: number, hasThumbnail?: boolean): Promise<boolean>;
  abstract deleteAttachment(workspaceId: string, id: string): Promise<boolean>;
  /** Puts ready, unattached files of this uploader in this channel on a message; returns how many. */
  abstract attach(workspaceId: string, ids: string[], uploaderId: string, channelId: string, messageId: string): Promise<number>;
  abstract attachmentsFor(workspaceId: string, messageIds: string[]): Promise<Map<string, ChatAttachmentRecord[]>>;
  /** An uploader's files that never made it onto a message, older than `before`. */
  abstract staleAttachments(workspaceId: string, uploaderId: string, before: Date): Promise<ChatAttachmentRecord[]>;
  abstract countPending(workspaceId: string, uploaderId: string): Promise<number>;

  abstract insertMessage(input: { workspaceId: string; channelId: string; authorId: string; body: string; parentId: string | null; kind: 'user' | 'system'; taskId: string | null }): Promise<string>;
  abstract findMessage(workspaceId: string, messageId: string): Promise<ChatMessageRecord | null>;
  abstract editMessage(workspaceId: string, messageId: string, authorId: string, body: string): Promise<boolean>;
  /** A system line's text (e.g. a call that ended); not shown as edited. */
  abstract editSystemMessage(workspaceId: string, messageId: string, authorId: string, body: string): Promise<boolean>;
  abstract deleteMessage(workspaceId: string, messageId: string, authorId: string): Promise<boolean>;
  /** Top-level messages, newest first, before `before` when given. */
  abstract listChannelMessages(workspaceId: string, channelId: string, before: MessagePosition | null, limit: number): Promise<ChatMessageRecord[]>;
  /** Replies to a root, oldest first, after `after` when given. */
  abstract listThread(workspaceId: string, rootId: string, after: MessagePosition | null, limit: number): Promise<ChatMessageRecord[]>;
}
