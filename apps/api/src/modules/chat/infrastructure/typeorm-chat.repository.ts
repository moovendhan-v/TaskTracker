import { Injectable } from '@nestjs/common';
import type { ChatChannelKind, ChatMemberRole, ChatReactionSummary } from '@taskflow/shared-types';
import { TransactionalManager } from '../../../core/database/transactional-manager.js';
import {
  ChatRepository,
  type ChatAttachmentRecord,
  type ChatChannelRecord,
  type ChatMemberRecord,
  type ChatMessageRecord,
  type ChatPersonRecord,
  type MessagePosition,
} from '../domain/chat.repository.js';

/** UPDATE/DELETE … RETURNING come back as [rows, count]; SELECT and INSERT as rows. */
const rowsOf = <T>(result: unknown): T[] => (Array.isArray(result) && Array.isArray(result[0]) ? (result[0] as T[]) : (result as T[]));

interface ChannelRow {
  id: string;
  workspace_id: string;
  kind: ChatChannelKind;
  name: string | null;
  topic: string;
  created_by: string | null;
  archived_at: Date | null;
  created_at: Date;
  my_role: ChatMemberRole | null;
  muted: boolean | null;
  member_count: string;
  unread_count: string;
  last_message_at: Date | null;
}

/** A channel with the caller's membership ($2), member count, unread count and latest message time. */
const CHANNEL_SELECT = `
  SELECT c.id, c.workspace_id, c.kind, c.name, c.topic, c.created_by, c.archived_at, c.created_at,
         me.role AS my_role, me.muted,
         (SELECT count(*) FROM chat_member m WHERE m.channel_id = c.id) AS member_count,
         CASE WHEN me.user_id IS NULL THEN 0 ELSE (
           SELECT count(*) FROM chat_message x
           WHERE x.channel_id = c.id AND x.deleted_at IS NULL AND x.parent_id IS NULL
             AND x.author_id IS DISTINCT FROM $2 AND x.created_at > coalesce(me.last_read_at, me.joined_at)
         ) END AS unread_count,
         (SELECT max(x.created_at) FROM chat_message x WHERE x.channel_id = c.id) AS last_message_at
  FROM chat_channel c
  LEFT JOIN chat_member me ON me.channel_id = c.id AND me.user_id = $2`;

const toChannel = (row: ChannelRow): ChatChannelRecord => ({
  id: row.id,
  workspaceId: row.workspace_id,
  kind: row.kind,
  name: row.name,
  topic: row.topic,
  createdBy: row.created_by,
  archivedAt: row.archived_at ? new Date(row.archived_at) : null,
  createdAt: new Date(row.created_at),
  myRole: row.my_role,
  muted: row.muted ?? false,
  memberCount: Number(row.member_count),
  unreadCount: Number(row.unread_count),
  lastMessageAt: row.last_message_at ? new Date(row.last_message_at) : null,
});

interface MessageRow {
  id: string;
  channel_id: string;
  parent_id: string | null;
  author_id: string | null;
  author_name: string | null;
  kind: 'user' | 'system';
  body: string;
  task_id: string | null;
  reply_count: string;
  last_reply_at: Date | null;
  edited_at: Date | null;
  deleted_at: Date | null;
  created_at: Date;
  position_at: string;
}

const MESSAGE_SELECT = `
  SELECT m.id, m.channel_id, m.parent_id, m.author_id, u.name AS author_name, m.kind,
         CASE WHEN m.deleted_at IS NULL THEN m.body ELSE '' END AS body,
         m.task_id, m.edited_at, m.deleted_at, m.created_at, m.created_at::text AS position_at,
         (SELECT count(*) FROM chat_message r WHERE r.parent_id = m.id AND r.deleted_at IS NULL) AS reply_count,
         (SELECT max(r.created_at) FROM chat_message r WHERE r.parent_id = m.id) AS last_reply_at
  FROM chat_message m
  LEFT JOIN "user" u ON u.id = m.author_id`;

const toMessage = (row: MessageRow): ChatMessageRecord => ({
  id: row.id,
  channelId: row.channel_id,
  parentId: row.parent_id,
  authorId: row.author_id,
  authorName: row.author_name,
  kind: row.kind,
  body: row.body,
  taskId: row.task_id,
  replyCount: Number(row.reply_count),
  lastReplyAt: row.last_reply_at ? new Date(row.last_reply_at) : null,
  editedAt: row.edited_at ? new Date(row.edited_at) : null,
  deletedAt: row.deleted_at ? new Date(row.deleted_at) : null,
  createdAt: new Date(row.created_at),
  position: { at: row.position_at, id: row.id },
});

interface AttachmentRow {
  id: string;
  channel_id: string;
  uploader_id: string;
  message_id: string | null;
  file_name: string;
  content_type: string | null;
  declared_size: string;
  size: string | null;
  storage_key: string;
  status: 'pending' | 'ready';
  created_at: Date;
}

const ATTACHMENT_SELECT = `SELECT id, channel_id, uploader_id, message_id, file_name, content_type, declared_size, size, storage_key, status, created_at FROM chat_attachment`;

const toAttachment = (row: AttachmentRow): ChatAttachmentRecord => ({
  id: row.id,
  channelId: row.channel_id,
  uploaderId: row.uploader_id,
  messageId: row.message_id,
  fileName: row.file_name,
  contentType: row.content_type,
  declaredSize: Number(row.declared_size),
  size: row.size === null ? null : Number(row.size),
  storageKey: row.storage_key,
  status: row.status,
  createdAt: new Date(row.created_at),
});

/**
 * Bound parameters only. Row-level security decides which channels and messages
 * exist for the caller; every statement also filters by workspace.
 */
@Injectable()
export class TypeOrmChatRepository extends ChatRepository {
  constructor(private readonly transactional: TransactionalManager) {
    super();
  }

  private query<T>(sql: string, params: unknown[]): Promise<T[]> {
    return this.transactional.manager.query(sql, params).then((result: unknown) => rowsOf<T>(result));
  }

  async listMyChannels(workspaceId: string, userId: string): Promise<ChatChannelRecord[]> {
    const rows = await this.query<ChannelRow>(`${CHANNEL_SELECT} WHERE c.workspace_id = $1 AND me.user_id IS NOT NULL ORDER BY c.kind = 'dm', c.name, c.created_at LIMIT 500`, [workspaceId, userId]);
    return rows.map(toChannel);
  }

  async browsePublic(workspaceId: string, userId: string, search: string | null, limit: number): Promise<ChatChannelRecord[]> {
    const rows = await this.query<ChannelRow>(
      `${CHANNEL_SELECT} WHERE c.workspace_id = $1 AND c.kind = 'public' AND c.archived_at IS NULL
         AND ($3::text IS NULL OR c.name LIKE '%' || $3 || '%' OR c.topic ILIKE '%' || $3 || '%')
       ORDER BY c.name LIMIT $4`,
      [workspaceId, userId, search, limit],
    );
    return rows.map(toChannel);
  }

  async findChannel(workspaceId: string, userId: string, channelId: string): Promise<ChatChannelRecord | null> {
    const [row] = await this.query<ChannelRow>(`${CHANNEL_SELECT} WHERE c.workspace_id = $1 AND c.id = $3`, [workspaceId, userId, channelId]);
    return row ? toChannel(row) : null;
  }

  async findDm(workspaceId: string, userId: string, dmKey: string): Promise<ChatChannelRecord | null> {
    const [row] = await this.query<ChannelRow>(`${CHANNEL_SELECT} WHERE c.workspace_id = $1 AND c.dm_key = $3`, [workspaceId, userId, dmKey]);
    return row ? toChannel(row) : null;
  }

  async nameTaken(workspaceId: string, name: string, exceptId: string | null): Promise<boolean> {
    // Private names count too, but RLS hides those rows; the unique index catches them as CONFLICT.
    const rows = await this.query(`SELECT 1 FROM chat_channel WHERE workspace_id = $1 AND name = $2 AND ($3::uuid IS NULL OR id <> $3)`, [workspaceId, name, exceptId]);
    return rows.length > 0;
  }

  async insertChannel(input: { workspaceId: string; kind: ChatChannelKind; name: string | null; topic: string; dmKey: string | null; createdBy: string }): Promise<string> {
    const [row] = await this.query<{ id: string }>(
      `INSERT INTO chat_channel (workspace_id, kind, name, topic, dm_key, created_by) VALUES ($1, $2, $3, $4, $5, $6) RETURNING id`,
      [input.workspaceId, input.kind, input.name, input.topic, input.dmKey, input.createdBy],
    );
    return row!.id;
  }

  async updateChannel(workspaceId: string, channelId: string, changes: { name?: string; topic?: string; archived?: boolean }): Promise<boolean> {
    const rows = await this.query(
      `UPDATE chat_channel SET name = coalesce($3, name), topic = coalesce($4, topic),
         archived_at = CASE WHEN $5::boolean IS NULL THEN archived_at WHEN $5 THEN coalesce(archived_at, now()) ELSE NULL END
       WHERE workspace_id = $1 AND id = $2 AND kind <> 'dm' RETURNING id`,
      [workspaceId, channelId, changes.name ?? null, changes.topic ?? null, changes.archived ?? null],
    );
    return rows.length > 0;
  }

  async dmPeople(workspaceId: string, channelIds: string[], exceptUserId: string): Promise<Map<string, ChatPersonRecord[]>> {
    const people = new Map<string, ChatPersonRecord[]>();
    if (channelIds.length === 0) return people;
    const rows = await this.query<{ channel_id: string; id: string; name: string }>(
      `SELECT m.channel_id, u.id, u.name FROM chat_member m JOIN "user" u ON u.id = m.user_id
       WHERE m.workspace_id = $1 AND m.channel_id = ANY($2::uuid[]) AND m.user_id <> $3 ORDER BY u.name`,
      [workspaceId, channelIds, exceptUserId],
    );
    for (const row of rows) people.set(row.channel_id, [...(people.get(row.channel_id) ?? []), { id: row.id, name: row.name }]);
    return people;
  }

  async listMembers(workspaceId: string, channelId: string, limit: number): Promise<ChatMemberRecord[]> {
    const rows = await this.query<{ user_id: string; name: string; role: ChatMemberRole; joined_at: Date }>(
      `SELECT m.user_id, u.name, m.role, m.joined_at FROM chat_member m JOIN "user" u ON u.id = m.user_id
       WHERE m.workspace_id = $1 AND m.channel_id = $2 ORDER BY m.role = 'member', u.name LIMIT $3`,
      [workspaceId, channelId, limit],
    );
    return rows.map((row) => ({ userId: row.user_id, name: row.name, role: row.role, joinedAt: new Date(row.joined_at) }));
  }

  async memberIds(workspaceId: string, channelId: string): Promise<string[]> {
    const rows = await this.query<{ user_id: string }>(`SELECT user_id FROM chat_member WHERE workspace_id = $1 AND channel_id = $2`, [workspaceId, channelId]);
    return rows.map((row) => row.user_id);
  }

  async memberRole(workspaceId: string, channelId: string, userId: string): Promise<ChatMemberRole | null> {
    const [row] = await this.query<{ role: ChatMemberRole }>(`SELECT role FROM chat_member WHERE workspace_id = $1 AND channel_id = $2 AND user_id = $3`, [workspaceId, channelId, userId]);
    return row?.role ?? null;
  }

  async countMembers(workspaceId: string, channelId: string): Promise<{ total: number; owners: number }> {
    const [row] = await this.query<{ total: string; owners: string }>(
      `SELECT count(*) AS total, count(*) FILTER (WHERE role = 'owner') AS owners FROM chat_member WHERE workspace_id = $1 AND channel_id = $2`,
      [workspaceId, channelId],
    );
    return { total: Number(row?.total ?? 0), owners: Number(row?.owners ?? 0) };
  }

  async addMembers(workspaceId: string, channelId: string, members: { userId: string; role: ChatMemberRole }[]): Promise<number> {
    let added = 0;
    // One at a time: the creator's own row has to exist before they can add anyone as its owner.
    for (const member of members) {
      const rows = await this.query(
        `INSERT INTO chat_member (channel_id, user_id, workspace_id, role) VALUES ($1, $2, $3, $4) ON CONFLICT (channel_id, user_id) DO NOTHING RETURNING user_id`,
        [channelId, member.userId, workspaceId, member.role],
      );
      added += rows.length;
    }
    return added;
  }

  async removeMember(workspaceId: string, channelId: string, userId: string): Promise<boolean> {
    const rows = await this.query(`DELETE FROM chat_member WHERE workspace_id = $1 AND channel_id = $2 AND user_id = $3 RETURNING user_id`, [workspaceId, channelId, userId]);
    return rows.length > 0;
  }

  async setMemberRole(workspaceId: string, channelId: string, userId: string, role: ChatMemberRole): Promise<boolean> {
    const rows = await this.query(`UPDATE chat_member SET role = $4 WHERE workspace_id = $1 AND channel_id = $2 AND user_id = $3 RETURNING user_id`, [workspaceId, channelId, userId, role]);
    return rows.length > 0;
  }

  async markRead(workspaceId: string, channelId: string, userId: string, at: Date): Promise<boolean> {
    // Never moves backwards, and never past now.
    const rows = await this.query(
      `UPDATE chat_member SET last_read_at = greatest(coalesce(last_read_at, '-infinity'), least($4::timestamptz, now()))
       WHERE workspace_id = $1 AND channel_id = $2 AND user_id = $3 RETURNING user_id`,
      [workspaceId, channelId, userId, at.toISOString()],
    );
    return rows.length > 0;
  }

  async setMuted(workspaceId: string, channelId: string, userId: string, muted: boolean): Promise<boolean> {
    const rows = await this.query(`UPDATE chat_member SET muted = $4 WHERE workspace_id = $1 AND channel_id = $2 AND user_id = $3 RETURNING user_id`, [workspaceId, channelId, userId, muted]);
    return rows.length > 0;
  }

  async memberNames(workspaceId: string, userIds: string[]): Promise<Map<string, string>> {
    if (userIds.length === 0) return new Map();
    const rows = await this.query<{ id: string; name: string }>(
      `SELECT u.id, u.name FROM workspace_member wm JOIN "user" u ON u.id = wm.user_id WHERE wm.workspace_id = $1 AND wm.user_id = ANY($2::text[])`,
      [workspaceId, userIds],
    );
    return new Map(rows.map((row) => [row.id, row.name]));
  }

  async workspaceMembers(workspaceId: string, userIds: string[]): Promise<string[]> {
    if (userIds.length === 0) return [];
    const rows = await this.query<{ user_id: string }>(`SELECT user_id FROM workspace_member WHERE workspace_id = $1 AND user_id = ANY($2::text[])`, [workspaceId, userIds]);
    return rows.map((row) => row.user_id);
  }

  async reactionsFor(workspaceId: string, messageIds: string[], userId: string): Promise<Map<string, ChatReactionSummary[]>> {
    const byMessage = new Map<string, ChatReactionSummary[]>();
    if (messageIds.length === 0) return byMessage;
    const rows = await this.query<{ message_id: string; emoji: string; count: string; mine: boolean; names: string[] }>(
      `SELECT r.message_id, r.emoji, count(*) AS count, bool_or(r.user_id = $3) AS mine,
              (array_agg(u.name ORDER BY r.created_at))[1:5] AS names
       FROM chat_reaction r JOIN "user" u ON u.id = r.user_id
       WHERE r.workspace_id = $1 AND r.message_id = ANY($2::uuid[])
       GROUP BY r.message_id, r.emoji
       ORDER BY min(r.created_at)`,
      [workspaceId, messageIds, userId],
    );
    for (const row of rows) {
      const summary = { emoji: row.emoji, count: Number(row.count), mine: row.mine, names: row.names };
      byMessage.set(row.message_id, [...(byMessage.get(row.message_id) ?? []), summary]);
    }
    return byMessage;
  }

  async toggleReaction(input: { workspaceId: string; channelId: string; messageId: string; userId: string; emoji: string }): Promise<boolean> {
    const removed = await this.query(
      `DELETE FROM chat_reaction WHERE workspace_id = $1 AND message_id = $2 AND user_id = $3 AND emoji = $4 RETURNING emoji`,
      [input.workspaceId, input.messageId, input.userId, input.emoji],
    );
    if (removed.length > 0) return false;
    await this.query(
      `INSERT INTO chat_reaction (message_id, user_id, emoji, workspace_id, channel_id) VALUES ($1, $2, $3, $4, $5) ON CONFLICT DO NOTHING`,
      [input.messageId, input.userId, input.emoji, input.workspaceId, input.channelId],
    );
    return true;
  }

  async searchMessages(workspaceId: string, tsquery: string, channelId: string | null, limit: number): Promise<{ record: ChatMessageRecord; channelKind: ChatChannelKind; channelName: string | null }[]> {
    const rows = await this.query<MessageRow & { channel_kind: ChatChannelKind; channel_name: string | null }>(
      `SELECT found.*, c.kind AS channel_kind, c.name AS channel_name
       FROM (
         ${MESSAGE_SELECT}
         WHERE m.workspace_id = $1 AND m.deleted_at IS NULL AND m.kind = 'user'
           AND m.search @@ to_tsquery('simple', $2)
           AND ($3::uuid IS NULL OR m.channel_id = $3)
         ORDER BY m.created_at DESC, m.id DESC
         LIMIT $4
       ) found
       JOIN chat_channel c ON c.id = found.channel_id
       ORDER BY found.created_at DESC, found.id DESC`,
      [workspaceId, tsquery, channelId, limit],
    );
    return rows.map((row) => ({ record: toMessage(row), channelKind: row.channel_kind, channelName: row.channel_name }));
  }

  async messagesAboutTask(workspaceId: string, taskId: string, number: number, limit: number): Promise<{ record: ChatMessageRecord; channelKind: ChatChannelKind; channelName: string | null }[]> {
    if (!Number.isSafeInteger(number) || number < 1) return [];
    // The search index finds the number; the pattern (a bound value built from an integer) checks it's #N or a task card.
    const rows = await this.query<MessageRow & { channel_kind: ChatChannelKind; channel_name: string | null }>(
      `SELECT found.*, c.kind AS channel_kind, c.name AS channel_name
       FROM (
         ${MESSAGE_SELECT}
         WHERE m.workspace_id = $1 AND m.deleted_at IS NULL
           AND (m.task_id = $2 OR (m.search @@ to_tsquery('simple', $3) AND m.body ~ $4))
         ORDER BY m.created_at DESC, m.id DESC
         LIMIT $5
       ) found
       JOIN chat_channel c ON c.id = found.channel_id
       ORDER BY found.created_at DESC, found.id DESC`,
      [workspaceId, taskId, String(number), `(^|[^A-Za-z0-9_&#])#${number}([^0-9]|$)|:::task ${number}([^0-9]|$)`, limit],
    );
    return rows.map((row) => ({ record: toMessage(row), channelKind: row.channel_kind, channelName: row.channel_name }));
  }

  async insertAttachment(input: { workspaceId: string; channelId: string; uploaderId: string; fileName: string; declaredSize: number; storageKey: string }): Promise<string> {
    const [row] = await this.query<{ id: string }>(
      `INSERT INTO chat_attachment (workspace_id, channel_id, uploader_id, file_name, declared_size, storage_key) VALUES ($1, $2, $3, $4, $5, $6) RETURNING id`,
      [input.workspaceId, input.channelId, input.uploaderId, input.fileName, input.declaredSize, input.storageKey],
    );
    return row!.id;
  }

  async findAttachment(workspaceId: string, id: string): Promise<ChatAttachmentRecord | null> {
    const [row] = await this.query<AttachmentRow>(`${ATTACHMENT_SELECT} WHERE workspace_id = $1 AND id = $2`, [workspaceId, id]);
    return row ? toAttachment(row) : null;
  }

  async markAttachmentReady(workspaceId: string, id: string, contentType: string, size: number): Promise<boolean> {
    const rows = await this.query(
      `UPDATE chat_attachment SET status = 'ready', content_type = $3, size = $4 WHERE workspace_id = $1 AND id = $2 AND status = 'pending' RETURNING id`,
      [workspaceId, id, contentType, size],
    );
    return rows.length > 0;
  }

  async deleteAttachment(workspaceId: string, id: string): Promise<boolean> {
    const rows = await this.query(`DELETE FROM chat_attachment WHERE workspace_id = $1 AND id = $2 RETURNING id`, [workspaceId, id]);
    return rows.length > 0;
  }

  async attach(workspaceId: string, ids: string[], uploaderId: string, channelId: string, messageId: string): Promise<number> {
    if (ids.length === 0) return 0;
    const rows = await this.query(
      `UPDATE chat_attachment SET message_id = $5
       WHERE workspace_id = $1 AND id = ANY($2::uuid[]) AND uploader_id = $3 AND channel_id = $4 AND status = 'ready' AND message_id IS NULL
       RETURNING id`,
      [workspaceId, ids, uploaderId, channelId, messageId],
    );
    return rows.length;
  }

  async attachmentsFor(workspaceId: string, messageIds: string[]): Promise<Map<string, ChatAttachmentRecord[]>> {
    const byMessage = new Map<string, ChatAttachmentRecord[]>();
    if (messageIds.length === 0) return byMessage;
    const rows = await this.query<AttachmentRow>(`${ATTACHMENT_SELECT} WHERE workspace_id = $1 AND message_id = ANY($2::uuid[]) ORDER BY created_at, id`, [workspaceId, messageIds]);
    for (const row of rows) byMessage.set(row.message_id!, [...(byMessage.get(row.message_id!) ?? []), toAttachment(row)]);
    return byMessage;
  }

  async staleAttachments(workspaceId: string, uploaderId: string, before: Date): Promise<ChatAttachmentRecord[]> {
    const rows = await this.query<AttachmentRow>(
      `${ATTACHMENT_SELECT} WHERE workspace_id = $1 AND uploader_id = $2 AND message_id IS NULL AND created_at < $3 LIMIT 50`,
      [workspaceId, uploaderId, before.toISOString()],
    );
    return rows.map(toAttachment);
  }

  async countPending(workspaceId: string, uploaderId: string): Promise<number> {
    const [row] = await this.query<{ count: string }>(`SELECT count(*) FROM chat_attachment WHERE workspace_id = $1 AND uploader_id = $2 AND message_id IS NULL`, [workspaceId, uploaderId]);
    return Number(row?.count ?? 0);
  }

  async insertMessage(input: { workspaceId: string; channelId: string; authorId: string; body: string; parentId: string | null; kind: 'user' | 'system'; taskId: string | null }): Promise<string> {
    const [row] = await this.query<{ id: string }>(
      `INSERT INTO chat_message (workspace_id, channel_id, author_id, body, parent_id, kind, task_id) VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id`,
      [input.workspaceId, input.channelId, input.authorId, input.body, input.parentId, input.kind, input.taskId],
    );
    return row!.id;
  }

  async findMessage(workspaceId: string, messageId: string): Promise<ChatMessageRecord | null> {
    const [row] = await this.query<MessageRow>(`${MESSAGE_SELECT} WHERE m.workspace_id = $1 AND m.id = $2`, [workspaceId, messageId]);
    return row ? toMessage(row) : null;
  }

  async editMessage(workspaceId: string, messageId: string, authorId: string, body: string): Promise<boolean> {
    const rows = await this.query(
      `UPDATE chat_message SET body = $4, edited_at = now() WHERE workspace_id = $1 AND id = $2 AND author_id = $3 AND kind = 'user' AND deleted_at IS NULL RETURNING id`,
      [workspaceId, messageId, authorId, body],
    );
    return rows.length > 0;
  }

  async deleteMessage(workspaceId: string, messageId: string, authorId: string): Promise<boolean> {
    const rows = await this.query(
      `UPDATE chat_message SET body = '', deleted_at = now() WHERE workspace_id = $1 AND id = $2 AND author_id = $3 AND deleted_at IS NULL RETURNING id`,
      [workspaceId, messageId, authorId],
    );
    return rows.length > 0;
  }

  async listChannelMessages(workspaceId: string, channelId: string, before: MessagePosition | null, limit: number): Promise<ChatMessageRecord[]> {
    const rows = await this.query<MessageRow>(
      `${MESSAGE_SELECT}
       WHERE m.workspace_id = $1 AND m.channel_id = $2 AND m.parent_id IS NULL
         AND ($3::timestamptz IS NULL OR (m.created_at, m.id) < ($3::timestamptz, $4::uuid))
       ORDER BY m.created_at DESC, m.id DESC LIMIT $5`,
      [workspaceId, channelId, before?.at ?? null, before?.id ?? null, limit],
    );
    return rows.map(toMessage);
  }

  async listThread(workspaceId: string, rootId: string, after: MessagePosition | null, limit: number): Promise<ChatMessageRecord[]> {
    const rows = await this.query<MessageRow>(
      `${MESSAGE_SELECT}
       WHERE m.workspace_id = $1 AND m.parent_id = $2
         AND ($3::timestamptz IS NULL OR (m.created_at, m.id) > ($3::timestamptz, $4::uuid))
       ORDER BY m.created_at, m.id LIMIT $5`,
      [workspaceId, rootId, after?.at ?? null, after?.id ?? null, limit],
    );
    return rows.map(toMessage);
  }
}
