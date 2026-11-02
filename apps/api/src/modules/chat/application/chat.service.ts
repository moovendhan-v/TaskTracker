import { Injectable } from '@nestjs/common';
import {
  CHAT_ADD_MEMBERS_MAX,
  CHAT_CHANNEL_MEMBERS_MAX,
  CHAT_DM_MAX,
  CHAT_DM_MIN,
  CHAT_PAGE_MAX,
  CHAT_THREAD_PAGE_MAX,
  CHAT_TOPIC_MAX,
  cleanMessageBody,
  mentionedUserIds,
  mentionsToNames,
  isValidChannelName,
  taskTitleFromMessage,
  type ChatChannelResponse,
  type ChatMemberResponse,
  type ChatMemberRole,
  type ChatMessagePage,
  type ChatMessageResponse,
  type ChatReactionSummary,
  type ChatSearchHit,
  CHAT_SEARCH_MAX_LENGTH,
  CHAT_SEARCH_PAGE_MAX,
  CHAT_TYPING_EVERY_MS,
  isChatReaction,
} from '@taskflow/shared-types';
import { AuditLogger } from '../../../core/audit/audit-logger.port.js';
import { domainEvent, type ChangeKind, type DomainEventFacts } from '../../../core/events/domain-event.js';
import { EventBus } from '../../../core/events/event-bus.port.js';
import { DomainError } from '../../../core/domain/domain-error.js';
import type { Actor, WorkspaceAccess } from '../../../core/http/types/authenticated-request.js';
import { MembersService } from '../../members/application/members.service.js';
import { TasksService } from '../../tasks/application/tasks.service.js';
import { ChatRepository, type ChatChannelRecord, type ChatMessageRecord, type MessagePosition } from '../domain/chat.repository.js';
import { decodeCursor, encodeCursor } from '../domain/cursor.js';
import { toPrefixQuery } from '../domain/search-query.js';

const MEMBER_LIST_MAX = 500;

function toChannel(record: ChatChannelRecord, dmMembers: { id: string; name: string }[] = []): ChatChannelResponse {
  return {
    id: record.id,
    kind: record.kind,
    name: record.name,
    topic: record.topic,
    archived: record.archivedAt !== null,
    myRole: record.myRole,
    muted: record.muted,
    memberCount: record.memberCount,
    dmMembers: record.kind === 'dm' ? dmMembers : [],
    unreadCount: record.unreadCount,
    lastMessageAt: record.lastMessageAt?.toISOString() ?? null,
    createdAt: record.createdAt.toISOString(),
  };
}

function toMessage(record: ChatMessageRecord, reactions: ChatReactionSummary[] = []): ChatMessageResponse {
  return {
    id: record.id,
    channelId: record.channelId,
    parentId: record.parentId,
    authorId: record.authorId,
    authorName: record.authorName,
    kind: record.kind,
    body: record.body,
    taskId: record.taskId,
    replyCount: record.replyCount,
    lastReplyAt: record.lastReplyAt?.toISOString() ?? null,
    editedAt: record.editedAt?.toISOString() ?? null,
    deleted: record.deletedAt !== null,
    createdAt: record.createdAt.toISOString(),
    reactions: record.deletedAt ? [] : reactions,
  };
}


const clampPage = (first: number | null | undefined, max: number) => Math.min(Math.max(first ?? max, 1), max);

/**
 * Chat: channels, direct messages and threads (docs/plan/D1_CHAT.md). Row-level
 * security already hides what the caller can't read; this service adds the rules
 * RLS can't express (DM size, owners, archived channels) and the live events.
 *
 * Live events carry ids only. Public channels go to the whole workspace; private
 * channels and DMs go to each member separately, so nobody else even learns that
 * something happened there.
 */
@Injectable()
export class ChatService {
  constructor(
    private readonly chat: ChatRepository,
    private readonly events: EventBus,
    private readonly auditLogger: AuditLogger,
    private readonly tasks: TasksService,
    private readonly workspaceMembers: MembersService,
  ) {}

  // ── Channels ────────────────────────────────────────────────────────────

  async myChannels(access: WorkspaceAccess, actor: Actor): Promise<ChatChannelResponse[]> {
    const records = await this.chat.listMyChannels(access.workspaceId, actor.userId);
    const people = await this.chat.dmPeople(access.workspaceId, records.filter((record) => record.kind === 'dm').map((record) => record.id), actor.userId);
    return records.map((record) => toChannel(record, people.get(record.id)));
  }

  async browse(access: WorkspaceAccess, actor: Actor, search: string | null | undefined, first: number | null | undefined): Promise<ChatChannelResponse[]> {
    const term = search?.trim().toLowerCase().replace(/[%_\\]/g, '') || null;
    return (await this.chat.browsePublic(access.workspaceId, actor.userId, term, clampPage(first, CHAT_PAGE_MAX))).map((record) => toChannel(record));
  }

  async channel(access: WorkspaceAccess, actor: Actor, channelId: string): Promise<ChatChannelResponse> {
    const record = await this.readable(access, actor, channelId);
    const people = record.kind === 'dm' ? await this.chat.dmPeople(access.workspaceId, [record.id], actor.userId) : new Map();
    return toChannel(record, people.get(record.id));
  }

  async members(access: WorkspaceAccess, actor: Actor, channelId: string): Promise<ChatMemberResponse[]> {
    await this.readable(access, actor, channelId);
    return (await this.chat.listMembers(access.workspaceId, channelId, MEMBER_LIST_MAX)).map((member) => ({ ...member, joinedAt: member.joinedAt.toISOString() }));
  }

  async createChannel(actor: Actor, access: WorkspaceAccess, input: { name: string; topic?: string | null; kind: 'public' | 'private'; memberIds?: string[] | null }): Promise<ChatChannelResponse> {
    const name = input.name.trim();
    if (!isValidChannelName(name)) throw DomainError.invalid('Channel names use lowercase letters, numbers, - and _ (up to 80)');
    const topic = this.cleanTopic(input.topic);
    if (await this.chat.nameTaken(access.workspaceId, name, null)) throw DomainError.conflict(`#${name} already exists`);
    const others = await this.checkedPeople(access, actor, input.memberIds ?? [], CHAT_ADD_MEMBERS_MAX);

    const channelId = await this.chat.insertChannel({ workspaceId: access.workspaceId, kind: input.kind, name, topic, dmKey: null, createdBy: actor.userId });
    await this.chat.addMembers(access.workspaceId, channelId, [{ userId: actor.userId, role: 'owner' }, ...others.map((userId) => ({ userId, role: 'member' as const }))]);
    const created = await this.readable(access, actor, channelId);
    await this.announce(actor, created, 'chat_channel', 'created', channelId);
    return toChannel(created);
  }

  /** Finds the DM between exactly these people (you included), or starts it. */
  async openDirectMessage(actor: Actor, access: WorkspaceAccess, userIds: string[]): Promise<ChatChannelResponse> {
    const people = [...new Set([actor.userId, ...userIds])].sort();
    if (people.length < CHAT_DM_MIN || people.length > CHAT_DM_MAX) throw DomainError.invalid(`A direct message has ${CHAT_DM_MIN} to ${CHAT_DM_MAX} people, you included`);
    const others = await this.checkedPeople(access, actor, people, CHAT_DM_MAX);
    const dmKey = [actor.userId, ...others].sort().join(',');

    const existing = await this.chat.findDm(access.workspaceId, actor.userId, dmKey);
    if (existing) return this.channel(access, actor, existing.id);
    const channelId = await this.chat.insertChannel({ workspaceId: access.workspaceId, kind: 'dm', name: null, topic: '', dmKey, createdBy: actor.userId });
    // The creator holds the owner role only so the database lets them set the DM up; nobody can add people later.
    await this.chat.addMembers(access.workspaceId, channelId, [{ userId: actor.userId, role: 'owner' }, ...others.map((userId) => ({ userId, role: 'member' as const }))]);
    const created = await this.readable(access, actor, channelId);
    await this.announce(actor, created, 'chat_channel', 'created', channelId);
    return this.channel(access, actor, channelId);
  }

  async updateChannel(actor: Actor, access: WorkspaceAccess, channelId: string, changes: { name?: string | null; topic?: string | null }): Promise<ChatChannelResponse> {
    const channel = await this.manageable(actor, access, channelId);
    const name = changes.name?.trim() || undefined;
    if (name !== undefined) {
      if (!isValidChannelName(name)) throw DomainError.invalid('Channel names use lowercase letters, numbers, - and _ (up to 80)');
      if (name !== channel.name && (await this.chat.nameTaken(access.workspaceId, name, channelId))) throw DomainError.conflict(`#${name} already exists`);
    }
    const topic = changes.topic === undefined || changes.topic === null ? undefined : this.cleanTopic(changes.topic);
    await this.chat.updateChannel(access.workspaceId, channelId, { name, topic });
    await this.auditIfModerating(actor, access, channel, 'chat.channel.update', { name: name ?? channel.name, topicChanged: topic !== undefined });
    const updated = await this.readable(access, actor, channelId);
    await this.announce(actor, updated, 'chat_channel', 'updated', channelId);
    return toChannel(updated);
  }

  async setArchived(actor: Actor, access: WorkspaceAccess, channelId: string, archived: boolean): Promise<ChatChannelResponse> {
    const channel = await this.manageable(actor, access, channelId);
    await this.chat.updateChannel(access.workspaceId, channelId, { archived });
    await this.auditLogger.record(actor, {
      action: archived ? 'chat.channel.archive' : 'chat.channel.unarchive',
      targetType: 'chat_channel',
      targetId: channelId,
      workspaceId: access.workspaceId,
      metadata: { name: channel.name, kind: channel.kind, asOwner: channel.myRole === 'owner' },
    });
    const updated = await this.readable(access, actor, channelId);
    await this.announce(actor, updated, 'chat_channel', 'updated', channelId);
    return toChannel(updated);
  }

  async join(actor: Actor, access: WorkspaceAccess, channelId: string): Promise<ChatChannelResponse> {
    const channel = await this.readable(access, actor, channelId);
    if (channel.myRole) return toChannel(channel);
    if (channel.kind !== 'public') throw DomainError.notFound('Channel');
    this.assertOpen(channel);
    await this.assertRoom(access, channelId, 1);
    await this.chat.addMembers(access.workspaceId, channelId, [{ userId: actor.userId, role: 'member' }]);
    const joined = await this.readable(access, actor, channelId);
    await this.announce(actor, joined, 'chat_channel', 'updated', channelId);
    return toChannel(joined);
  }

  async leave(actor: Actor, access: WorkspaceAccess, channelId: string): Promise<boolean> {
    const channel = await this.readable(access, actor, channelId);
    if (!channel.myRole) return false;
    if (channel.kind === 'dm') throw DomainError.invalid("You can't leave a direct message");
    const counts = await this.chat.countMembers(access.workspaceId, channelId);
    if (channel.myRole === 'owner' && counts.owners === 1 && counts.total > 1) throw DomainError.invalid('Make someone else an owner before you leave');
    // Tell the remaining members before the row (and with it, for private channels, our view) goes.
    await this.announce(actor, channel, 'chat_channel', 'updated', channelId);
    return this.chat.removeMember(access.workspaceId, channelId, actor.userId);
  }

  async addMembers(actor: Actor, access: WorkspaceAccess, channelId: string, userIds: string[]): Promise<ChatMemberResponse[]> {
    const channel = await this.owned(access, actor, channelId);
    if (channel.kind === 'dm') throw DomainError.invalid('Start a new direct message to include more people');
    this.assertOpen(channel);
    const people = await this.checkedPeople(access, actor, userIds, CHAT_ADD_MEMBERS_MAX);
    await this.assertRoom(access, channelId, people.length);
    await this.chat.addMembers(access.workspaceId, channelId, people.map((userId) => ({ userId, role: 'member' as const })));
    await this.announce(actor, channel, 'chat_channel', 'updated', channelId);
    return this.members(access, actor, channelId);
  }

  async removeMember(actor: Actor, access: WorkspaceAccess, channelId: string, userId: string): Promise<boolean> {
    if (userId === actor.userId) return this.leave(actor, access, channelId);
    const channel = await this.owned(access, actor, channelId);
    if (channel.kind === 'dm') throw DomainError.invalid("People can't be removed from a direct message");
    // Announce first, so the person removed hears about it too.
    await this.announce(actor, channel, 'chat_channel', 'updated', channelId);
    return this.chat.removeMember(access.workspaceId, channelId, userId);
  }

  async setMemberRole(actor: Actor, access: WorkspaceAccess, channelId: string, userId: string, role: ChatMemberRole): Promise<ChatMemberResponse[]> {
    const channel = await this.owned(access, actor, channelId);
    if (channel.kind === 'dm') throw DomainError.invalid('Direct messages have no owners');
    if (role === 'member' && userId === actor.userId && (await this.chat.countMembers(access.workspaceId, channelId)).owners === 1) {
      throw DomainError.invalid('A channel needs at least one owner');
    }
    if (!(await this.chat.setMemberRole(access.workspaceId, channelId, userId, role))) throw DomainError.notFound('Member');
    await this.announce(actor, channel, 'chat_channel', 'updated', channelId);
    return this.members(access, actor, channelId);
  }

  async markRead(actor: Actor, access: WorkspaceAccess, channelId: string, at: Date): Promise<boolean> {
    return this.chat.markRead(access.workspaceId, channelId, actor.userId, at);
  }

  async setMuted(actor: Actor, access: WorkspaceAccess, channelId: string, muted: boolean): Promise<boolean> {
    return this.chat.setMuted(access.workspaceId, channelId, actor.userId, muted);
  }

  // ── Messages ────────────────────────────────────────────────────────────

  async messages(access: WorkspaceAccess, actor: Actor, channelId: string, before: string | null | undefined, first: number | null | undefined): Promise<ChatMessagePage> {
    await this.readable(access, actor, channelId);
    const limit = clampPage(first, CHAT_PAGE_MAX);
    return this.page(access, actor, await this.chat.listChannelMessages(access.workspaceId, channelId, this.cursor(before), limit), limit);
  }

  async message(access: WorkspaceAccess, actor: Actor, messageId: string): Promise<ChatMessageResponse> {
    const record = await this.findMessage(access, messageId);
    return toMessage(record, (await this.chat.reactionsFor(access.workspaceId, [record.id], actor.userId)).get(record.id));
  }

  async thread(access: WorkspaceAccess, actor: Actor, rootId: string, after: string | null | undefined, first: number | null | undefined): Promise<ChatMessagePage> {
    const root = await this.findMessage(access, rootId);
    if (root.parentId) throw DomainError.invalid('Threads start at a top-level message');
    const limit = clampPage(first, CHAT_THREAD_PAGE_MAX);
    return this.page(access, actor, await this.chat.listThread(access.workspaceId, rootId, this.cursor(after), limit), limit);
  }

  async send(actor: Actor, access: WorkspaceAccess, input: { channelId: string; body: string; parentId?: string | null }): Promise<ChatMessageResponse> {
    const body = this.cleanBody(input.body);
    const channel = await this.postable(actor, access, input.channelId);
    let parentId: string | null = null;
    if (input.parentId) {
      const parent = await this.findMessage(access, input.parentId);
      if (parent.channelId !== channel.id) throw DomainError.notFound('Message');
      parentId = parent.parentId ?? parent.id; // replying to a reply goes to its thread
    }
    const id = await this.chat.insertMessage({ workspaceId: access.workspaceId, channelId: channel.id, authorId: actor.userId, body, parentId, kind: 'user', taskId: null });
    await this.announce(actor, channel, 'chat_message', 'created', id, await this.mentionFacts(actor, access, channel, body));
    return this.message(access, actor, id);
  }

  async edit(actor: Actor, access: WorkspaceAccess, messageId: string, body: string): Promise<ChatMessageResponse> {
    const cleaned = this.cleanBody(body);
    const message = await this.ownMessage(actor, access, messageId);
    if (message.kind !== 'user') throw DomainError.invalid("System messages can't be edited");
    const channel = await this.readable(access, actor, message.channelId);
    this.assertOpen(channel);
    if (!(await this.chat.editMessage(access.workspaceId, messageId, actor.userId, cleaned))) throw DomainError.notFound('Message');
    await this.announce(actor, channel, 'chat_message', 'updated', messageId);
    return this.message(access, actor, messageId);
  }

  async remove(actor: Actor, access: WorkspaceAccess, messageId: string): Promise<boolean> {
    const message = await this.ownMessage(actor, access, messageId);
    const channel = await this.readable(access, actor, message.channelId);
    if (!(await this.chat.deleteMessage(access.workspaceId, messageId, actor.userId))) return false;
    await this.announce(actor, channel, 'chat_message', 'deleted', messageId);
    return true;
  }

  /** Creates a task from a message (with the caller's own task.create rights) and notes it in the thread. */
  async createTaskFromMessage(actor: Actor, access: WorkspaceAccess, input: { messageId: string; listId: string; title?: string | null }): Promise<ChatMessageResponse> {
    const message = await this.findMessage(access, input.messageId);
    if (message.deletedAt || message.kind !== 'user') throw DomainError.invalid('This message has nothing to turn into a task');
    const channel = await this.postable(actor, access, message.channelId);
    const title = (input.title?.trim() || taskTitleFromMessage(message.body)).slice(0, 200);
    if (!title) throw DomainError.invalid('The task needs a title');
    const where = channel.kind === 'dm' ? 'a direct message' : `#${channel.name}`;
    const task = await this.tasks.create(actor, access, input.listId, {
      title,
      description: `${message.body}\n\n— ${message.authorName ?? 'Someone'} in ${where}`.slice(0, 4_500),
    });
    const id = await this.chat.insertMessage({
      workspaceId: access.workspaceId,
      channelId: channel.id,
      authorId: actor.userId,
      body: `created #${task.number}`,
      parentId: message.parentId ?? message.id,
      kind: 'system',
      taskId: task.id,
    });
    await this.announce(actor, channel, 'chat_message', 'created', id);
    return this.message(access, actor, id);
  }

  /**
   * Full-text search over messages you can read (RLS decides), newest first. Each word
   * is matched as a prefix; only letters and digits reach the query.
   */
  async search(access: WorkspaceAccess, actor: Actor, text: string, channelId: string | null | undefined, first: number | null | undefined): Promise<ChatSearchHit[]> {
    if (text.length > CHAT_SEARCH_MAX_LENGTH) throw DomainError.invalid(`Search is at most ${CHAT_SEARCH_MAX_LENGTH} characters`);
    const tsquery = toPrefixQuery(text);
    if (!tsquery) return [];
    if (channelId) await this.readable(access, actor, channelId);
    const hits = await this.chat.searchMessages(access.workspaceId, tsquery, channelId ?? null, clampPage(first, CHAT_SEARCH_PAGE_MAX));
    const reactions = await this.chat.reactionsFor(access.workspaceId, hits.map((hit) => hit.record.id), actor.userId);
    return hits.map((hit) => ({ message: toMessage(hit.record, reactions.get(hit.record.id)), channelKind: hit.channelKind, channelName: hit.channelName }));
  }

  /** Adds or removes your reaction. Only members of an open channel react (posting in a public channel's reactions joins it). */
  async react(actor: Actor, access: WorkspaceAccess, messageId: string, emoji: string): Promise<ChatMessageResponse> {
    if (!isChatReaction(emoji)) throw DomainError.invalid('Pick one of the quick reactions');
    const message = await this.findMessage(access, messageId);
    if (message.deletedAt) throw DomainError.invalid('This message was deleted');
    const channel = await this.postable(actor, access, message.channelId);
    await this.chat.toggleReaction({ workspaceId: access.workspaceId, channelId: channel.id, messageId, userId: actor.userId, emoji });
    await this.announce(actor, channel, 'chat_message', 'updated', messageId);
    return this.message(access, actor, messageId);
  }

  /**
   * "Someone is typing": a live signal only, never stored, sent to the people who can
   * read the channel. Members of an open channel only; at most one per CHAT_TYPING_EVERY_MS per person.
   */
  async typing(actor: Actor, access: WorkspaceAccess, channelId: string): Promise<boolean> {
    const channel = await this.readable(access, actor, channelId);
    if (!channel.myRole || channel.archivedAt) return false;
    const key = `${access.workspaceId}:${channelId}:${actor.userId}`;
    const now = Date.now();
    if (now - (this.lastTyping.get(key) ?? 0) < CHAT_TYPING_EVERY_MS - 500) return true;
    this.lastTyping.set(key, now);
    if (this.lastTyping.size > 10_000) this.lastTyping.clear();
    await this.announce(actor, channel, 'chat_typing', 'updated', channelId);
    return true;
  }

  private readonly lastTyping = new Map<string, number>();

  private async page(access: WorkspaceAccess, actor: Actor, items: ChatMessageRecord[], limit: number): Promise<ChatMessagePage> {
    const reactions = await this.chat.reactionsFor(access.workspaceId, items.map((item) => item.id), actor.userId);
    return {
      items: items.map((item) => toMessage(item, reactions.get(item.id))),
      cursor: items.length === limit ? encodeCursor(items[items.length - 1]!.position) : null,
    };
  }

  // ── Helpers ─────────────────────────────────────────────────────────────

  /** A channel the caller can read; anything else is not found, never forbidden, so it doesn't confirm it exists. */
  private async readable(access: WorkspaceAccess, actor: Actor, channelId: string): Promise<ChatChannelRecord> {
    const channel = await this.chat.findChannel(access.workspaceId, actor.userId, channelId);
    if (!channel) throw DomainError.notFound('Channel');
    return channel;
  }

  /** You need to be a member to post; posting in a public channel joins it. */
  private async postable(actor: Actor, access: WorkspaceAccess, channelId: string): Promise<ChatChannelRecord> {
    const channel = await this.readable(access, actor, channelId);
    this.assertOpen(channel);
    if (channel.myRole) return channel;
    if (channel.kind !== 'public') throw DomainError.notFound('Channel');
    await this.join(actor, access, channelId);
    return this.readable(access, actor, channelId);
  }

  private async owned(access: WorkspaceAccess, actor: Actor, channelId: string): Promise<ChatChannelRecord> {
    const channel = await this.readable(access, actor, channelId);
    if (channel.myRole !== 'owner') throw DomainError.forbidden('Only channel owners can do that');
    return channel;
  }

  /** Channel owners, or chat.manage for public channels. DMs can't be renamed or archived. */
  private async manageable(actor: Actor, access: WorkspaceAccess, channelId: string): Promise<ChatChannelRecord> {
    const channel = await this.readable(access, actor, channelId);
    if (channel.kind === 'dm') throw DomainError.invalid("Direct messages can't be renamed or archived");
    if (channel.myRole === 'owner') return channel;
    if (channel.kind === 'public' && access.permissions.has('chat.manage')) return channel;
    throw DomainError.forbidden('Only channel owners or chat admins can do that');
  }

  private async auditIfModerating(actor: Actor, access: WorkspaceAccess, channel: ChatChannelRecord, action: string, metadata: Record<string, unknown>): Promise<void> {
    if (channel.myRole === 'owner') return;
    await this.auditLogger.record(actor, { action, targetType: 'chat_channel', targetId: channel.id, workspaceId: access.workspaceId, metadata });
  }

  private async findMessage(access: WorkspaceAccess, messageId: string): Promise<ChatMessageRecord> {
    const message = await this.chat.findMessage(access.workspaceId, messageId);
    if (!message) throw DomainError.notFound('Message');
    return message;
  }

  private async ownMessage(actor: Actor, access: WorkspaceAccess, messageId: string): Promise<ChatMessageRecord> {
    const message = await this.findMessage(access, messageId);
    if (message.authorId !== actor.userId) throw DomainError.forbidden('You can only change your own messages');
    if (message.deletedAt) throw DomainError.invalid('This message was deleted');
    return message;
  }

  /** Workspace members among `userIds`, without the caller. Anyone else is refused. */
  private async checkedPeople(access: WorkspaceAccess, actor: Actor, userIds: string[], max: number): Promise<string[]> {
    const others = [...new Set(userIds)].filter((id) => id !== actor.userId);
    if (others.length > max) throw DomainError.invalid(`At most ${max} people at a time`);
    const found = new Set(await this.chat.workspaceMembers(access.workspaceId, others));
    if (others.some((id) => !found.has(id))) throw DomainError.invalid('Everyone has to be a member of this workspace');
    return others;
  }

  private async assertRoom(access: WorkspaceAccess, channelId: string, adding: number): Promise<void> {
    const { total } = await this.chat.countMembers(access.workspaceId, channelId);
    if (total + adding > CHAT_CHANNEL_MEMBERS_MAX) throw DomainError.invalid(`A channel can have at most ${CHAT_CHANNEL_MEMBERS_MAX} members`);
  }

  private assertOpen(channel: ChatChannelRecord): void {
    if (channel.archivedAt) throw DomainError.invalid('This channel is archived');
  }

  private cleanBody(body: string): string {
    const cleaned = cleanMessageBody(body);
    if (cleaned === null) throw DomainError.invalid('A message needs 1 to 4000 characters');
    return cleaned;
  }

  private cleanTopic(topic: string | null | undefined): string {
    const cleaned = (topic ?? '').trim();
    if (cleaned.length > CHAT_TOPIC_MAX) throw DomainError.invalid(`A topic has at most ${CHAT_TOPIC_MAX} characters`);
    return cleaned;
  }

  private cursor(value: string | null | undefined): MessagePosition | null {
    if (!value) return null;
    const position = decodeCursor(value);
    if (!position) throw DomainError.invalid('Invalid cursor');
    return position;
  }

  /** Public channels: everyone in the workspace. Private channels and DMs: each member, one by one. */
  private async announce(actor: Actor, channel: ChatChannelRecord, entityType: 'chat_channel' | 'chat_message' | 'chat_typing', change: ChangeKind, entityId: string, facts?: DomainEventFacts): Promise<void> {
    const base = { workspaceId: channel.workspaceId, entityId, actorId: actor.userId };
    if (channel.kind === 'public') {
      await this.events.publish(domainEvent(entityType, change, { ...base, facts }));
      return;
    }
    // Facts (e.g. who to notify) ride on the first event only, so in-process handlers act once.
    let first = true;
    for (const recipientId of await this.chat.memberIds(channel.workspaceId, channel.id)) {
      await this.events.publish(domainEvent(entityType, change, { ...base, recipientId, facts: first ? facts : undefined }));
      first = false;
    }
  }

  /**
   * Who a message's @mentions notify: only people who can read the channel (its members,
   * or anyone with chat.use for a public channel), never the author. The excerpt shows names, not ids.
   */
  private async mentionFacts(actor: Actor, access: WorkspaceAccess, channel: ChatChannelRecord, body: string): Promise<DomainEventFacts | undefined> {
    const mentioned = mentionedUserIds(body).filter((id) => id !== actor.userId);
    if (mentioned.length === 0) return undefined;
    const withChat = new Set(await this.workspaceMembers.listUserIdsWithPermission(access.workspaceId, 'chat.use'));
    const readers = channel.kind === 'public' ? withChat : new Set((await this.chat.memberIds(access.workspaceId, channel.id)).filter((id) => withChat.has(id)));
    const mentionIds = mentioned.filter((id) => readers.has(id));
    if (mentionIds.length === 0) return undefined;
    const names = await this.chat.memberNames(access.workspaceId, mentionedUserIds(body));
    return {
      mentionIds,
      title: channel.kind === 'dm' ? 'a direct message' : `#${channel.name}`,
      excerpt: mentionsToNames(body, (id) => names.get(id)).replace(/[*_`>#]/g, ''),
    };
  }
}
