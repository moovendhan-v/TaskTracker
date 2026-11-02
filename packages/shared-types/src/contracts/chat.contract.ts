import type { ChatChannelKind, ChatMemberRole } from '../domain/chat.js';

export interface ChatChannelResponse {
  id: string;
  kind: ChatChannelKind;
  /** Null for direct messages. */
  name: string | null;
  topic: string;
  archived: boolean;
  /** Your membership, or null for a public channel you haven't joined. */
  myRole: ChatMemberRole | null;
  muted: boolean;
  memberCount: number;
  /** For direct messages: the other people in it. */
  dmMembers: ChatPersonResponse[];
  unreadCount: number;
  lastMessageAt: string | null;
  createdAt: string;
}

export interface ChatPersonResponse {
  id: string;
  name: string;
}

export interface ChatMemberResponse {
  userId: string;
  name: string;
  role: ChatMemberRole;
  joinedAt: string;
}

export interface ChatMessageResponse {
  id: string;
  channelId: string;
  parentId: string | null;
  authorId: string | null;
  authorName: string | null;
  kind: 'user' | 'system';
  /** Markdown. Clients render it without raw HTML. Empty once deleted. */
  body: string;
  /** Set on system lines such as "created #123". */
  taskId: string | null;
  replyCount: number;
  lastReplyAt: string | null;
  editedAt: string | null;
  deleted: boolean;
  createdAt: string;
}

export interface ChatMessagePage {
  items: ChatMessageResponse[];
  /** Pass as `before` (channel) or `after` (thread) for the next page; null when there is none. */
  cursor: string | null;
}

export interface CreateChatChannelRequest {
  name: string;
  topic?: string;
  kind: 'public' | 'private';
  memberIds?: string[];
}

export interface UpdateChatChannelRequest {
  name?: string;
  topic?: string;
}

export interface SendChatMessageRequest {
  channelId: string;
  body: string;
  parentId?: string | null;
}
