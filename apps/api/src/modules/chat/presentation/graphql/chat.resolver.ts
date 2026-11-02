import { Args, ID, Int, Mutation, Query, Resolver } from '@nestjs/graphql';
import { Throttle } from '@nestjs/throttler';
import { CHAT_ADD_MEMBERS_MAX, CHAT_DM_MAX, CHAT_MEMBER_ROLES, type ChatMemberRole } from '@taskflow/shared-types';
import { CurrentAccess } from '../../../../core/access/current-access.decorator.js';
import { RequirePermissions } from '../../../../core/access/require-permissions.decorator.js';
import { OptionalUuidArg, UuidArg, WorkspaceIdArg } from '../../../../core/graphql/args.js';
import { CurrentActor } from '../../../../core/http/decorators/current-actor.decorator.js';
import type { Actor, WorkspaceAccess } from '../../../../core/http/types/authenticated-request.js';
import { DomainError } from '../../../../core/domain/domain-error.js';
import { ChatService } from '../../application/chat.service.js';
import {
  ChatChannelGql,
  ChatMemberGql,
  ChatMessageGql,
  ChatMessagePageGql,
  ChatSearchHitGql,
  CreateChatChannelInput,
  CreateTaskFromMessageInput,
  SendChatMessageInput,
  UpdateChatChannelInput,
} from './chat.types.js';

const PER_MINUTE = (limit: number) => ({ default: { limit, ttl: 60_000 } });

/** Validates a list of user ids from an argument (they are checked against the workspace in the service). */
function userIds(ids: string[], max: number): string[] {
  if (!Array.isArray(ids) || ids.length > max || ids.some((id) => typeof id !== 'string' || id.length === 0 || id.length > 64)) {
    throw DomainError.invalid(`Up to ${max} user ids`);
  }
  return ids;
}

/**
 * Chat. Everything needs chat.use; renaming or archiving someone else's public
 * channel needs chat.manage (checked in the service, and audited). The user always
 * comes from the session.
 */
@Resolver(() => ChatChannelGql)
export class ChatResolver {
  constructor(private readonly service: ChatService) {}

  @Query(() => [ChatChannelGql], { description: 'Channels and direct messages you are in' })
  @RequirePermissions('chat.use')
  chatChannels(@WorkspaceIdArg() _w: string, @CurrentActor() actor: Actor, @CurrentAccess() access: WorkspaceAccess): Promise<ChatChannelGql[]> {
    return this.service.myChannels(access, actor);
  }

  @Query(() => [ChatChannelGql], { description: 'Public channels to join' })
  @RequirePermissions('chat.use')
  browseChatChannels(
    @WorkspaceIdArg() _w: string,
    @Args('search', { nullable: true, type: () => String }) search: string | null,
    @Args('first', { nullable: true, type: () => Int }) first: number | null,
    @CurrentActor() actor: Actor,
    @CurrentAccess() access: WorkspaceAccess,
  ): Promise<ChatChannelGql[]> {
    if (search && search.length > 80) throw DomainError.invalid('Search is too long');
    return this.service.browse(access, actor, search, first);
  }

  @Query(() => ChatChannelGql)
  @RequirePermissions('chat.use')
  chatChannel(@WorkspaceIdArg() _w: string, @UuidArg('channelId') channelId: string, @CurrentActor() actor: Actor, @CurrentAccess() access: WorkspaceAccess): Promise<ChatChannelGql> {
    return this.service.channel(access, actor, channelId);
  }

  @Query(() => [ChatMemberGql])
  @RequirePermissions('chat.use')
  chatChannelMembers(@WorkspaceIdArg() _w: string, @UuidArg('channelId') channelId: string, @CurrentActor() actor: Actor, @CurrentAccess() access: WorkspaceAccess): Promise<ChatMemberGql[]> {
    return this.service.members(access, actor, channelId);
  }

  @Query(() => ChatMessagePageGql, { description: 'Top-level messages, newest first' })
  @RequirePermissions('chat.use')
  chatMessages(
    @WorkspaceIdArg() _w: string,
    @UuidArg('channelId') channelId: string,
    @Args('before', { nullable: true, type: () => String }) before: string | null,
    @Args('first', { nullable: true, type: () => Int }) first: number | null,
    @CurrentActor() actor: Actor,
    @CurrentAccess() access: WorkspaceAccess,
  ): Promise<ChatMessagePageGql> {
    return this.service.messages(access, actor, channelId, before, first);
  }

  @Query(() => ChatMessageGql)
  @RequirePermissions('chat.use')
  chatMessage(@WorkspaceIdArg() _w: string, @UuidArg('messageId') messageId: string, @CurrentActor() actor: Actor, @CurrentAccess() access: WorkspaceAccess): Promise<ChatMessageGql> {
    return this.service.message(access, actor, messageId);
  }

  @Query(() => ChatMessagePageGql, { description: 'Replies to a message, oldest first' })
  @RequirePermissions('chat.use')
  chatThread(
    @WorkspaceIdArg() _w: string,
    @UuidArg('messageId') messageId: string,
    @Args('after', { nullable: true, type: () => String }) after: string | null,
    @Args('first', { nullable: true, type: () => Int }) first: number | null,
    @CurrentActor() actor: Actor,
    @CurrentAccess() access: WorkspaceAccess,
  ): Promise<ChatMessagePageGql> {
    return this.service.thread(access, actor, messageId, after, first);
  }

  @Query(() => [ChatSearchHitGql], { description: 'Messages you can read that match every word (as a prefix), newest first' })
  @RequirePermissions('chat.use')
  @Throttle(PER_MINUTE(30))
  searchChatMessages(
    @WorkspaceIdArg() _w: string,
    @Args('query', { type: () => String }) query: string,
    @OptionalUuidArg('channelId', 'Only this channel') channelId: string | null,
    @Args('first', { nullable: true, type: () => Int }) first: number | null,
    @CurrentActor() actor: Actor,
    @CurrentAccess() access: WorkspaceAccess,
  ): Promise<ChatSearchHitGql[]> {
    return this.service.search(access, actor, query, channelId, first);
  }

  @Mutation(() => ChatChannelGql)
  @RequirePermissions('chat.use')
  @Throttle(PER_MINUTE(10))
  createChatChannel(@WorkspaceIdArg() _w: string, @Args('input') input: CreateChatChannelInput, @CurrentActor() actor: Actor, @CurrentAccess() access: WorkspaceAccess): Promise<ChatChannelGql> {
    return this.service.createChannel(actor, access, input);
  }

  @Mutation(() => ChatChannelGql, { description: 'Finds or starts the direct message between you and these people' })
  @RequirePermissions('chat.use')
  @Throttle(PER_MINUTE(10))
  openDirectMessage(
    @WorkspaceIdArg() _w: string,
    @Args('userIds', { type: () => [ID] }) ids: string[],
    @CurrentActor() actor: Actor,
    @CurrentAccess() access: WorkspaceAccess,
  ): Promise<ChatChannelGql> {
    return this.service.openDirectMessage(actor, access, userIds(ids, CHAT_DM_MAX));
  }

  @Mutation(() => ChatChannelGql)
  @RequirePermissions('chat.use')
  updateChatChannel(
    @WorkspaceIdArg() _w: string,
    @UuidArg('channelId') channelId: string,
    @Args('input') input: UpdateChatChannelInput,
    @CurrentActor() actor: Actor,
    @CurrentAccess() access: WorkspaceAccess,
  ): Promise<ChatChannelGql> {
    return this.service.updateChannel(actor, access, channelId, input);
  }

  @Mutation(() => ChatChannelGql)
  @RequirePermissions('chat.use')
  archiveChatChannel(
    @WorkspaceIdArg() _w: string,
    @UuidArg('channelId') channelId: string,
    @Args('archived', { type: () => Boolean, defaultValue: true }) archived: boolean,
    @CurrentActor() actor: Actor,
    @CurrentAccess() access: WorkspaceAccess,
  ): Promise<ChatChannelGql> {
    return this.service.setArchived(actor, access, channelId, archived);
  }

  @Mutation(() => ChatChannelGql)
  @RequirePermissions('chat.use')
  joinChatChannel(@WorkspaceIdArg() _w: string, @UuidArg('channelId') channelId: string, @CurrentActor() actor: Actor, @CurrentAccess() access: WorkspaceAccess): Promise<ChatChannelGql> {
    return this.service.join(actor, access, channelId);
  }

  @Mutation(() => Boolean)
  @RequirePermissions('chat.use')
  leaveChatChannel(@WorkspaceIdArg() _w: string, @UuidArg('channelId') channelId: string, @CurrentActor() actor: Actor, @CurrentAccess() access: WorkspaceAccess): Promise<boolean> {
    return this.service.leave(actor, access, channelId);
  }

  @Mutation(() => [ChatMemberGql])
  @RequirePermissions('chat.use')
  @Throttle(PER_MINUTE(20))
  addChatChannelMembers(
    @WorkspaceIdArg() _w: string,
    @UuidArg('channelId') channelId: string,
    @Args('userIds', { type: () => [ID] }) ids: string[],
    @CurrentActor() actor: Actor,
    @CurrentAccess() access: WorkspaceAccess,
  ): Promise<ChatMemberGql[]> {
    return this.service.addMembers(actor, access, channelId, userIds(ids, CHAT_ADD_MEMBERS_MAX));
  }

  @Mutation(() => Boolean)
  @RequirePermissions('chat.use')
  removeChatChannelMember(
    @WorkspaceIdArg() _w: string,
    @UuidArg('channelId') channelId: string,
    @Args('userId', { type: () => ID }) userId: string,
    @CurrentActor() actor: Actor,
    @CurrentAccess() access: WorkspaceAccess,
  ): Promise<boolean> {
    return this.service.removeMember(actor, access, channelId, userIds([userId], 1)[0]!);
  }

  @Mutation(() => [ChatMemberGql], { description: 'Make someone an owner, or a plain member again' })
  @RequirePermissions('chat.use')
  setChatChannelMemberRole(
    @WorkspaceIdArg() _w: string,
    @UuidArg('channelId') channelId: string,
    @Args('userId', { type: () => ID }) userId: string,
    @Args('role', { type: () => String }) role: string,
    @CurrentActor() actor: Actor,
    @CurrentAccess() access: WorkspaceAccess,
  ): Promise<ChatMemberGql[]> {
    if (!(CHAT_MEMBER_ROLES as readonly string[]).includes(role)) throw DomainError.invalid('role is owner or member');
    return this.service.setMemberRole(actor, access, channelId, userIds([userId], 1)[0]!, role as ChatMemberRole);
  }

  @Mutation(() => Boolean, { description: 'Marks the channel read up to this time (never moves backwards)' })
  @RequirePermissions('chat.use')
  markChatChannelRead(
    @WorkspaceIdArg() _w: string,
    @UuidArg('channelId') channelId: string,
    @Args('at', { type: () => String }) at: string,
    @CurrentActor() actor: Actor,
    @CurrentAccess() access: WorkspaceAccess,
  ): Promise<boolean> {
    const when = new Date(at);
    if (at.length > 40 || Number.isNaN(when.getTime())) throw DomainError.invalid('at must be an ISO date-time');
    return this.service.markRead(actor, access, channelId, when);
  }

  @Mutation(() => Boolean)
  @RequirePermissions('chat.use')
  muteChatChannel(
    @WorkspaceIdArg() _w: string,
    @UuidArg('channelId') channelId: string,
    @Args('muted', { type: () => Boolean }) muted: boolean,
    @CurrentActor() actor: Actor,
    @CurrentAccess() access: WorkspaceAccess,
  ): Promise<boolean> {
    return this.service.setMuted(actor, access, channelId, muted);
  }

  @Mutation(() => ChatMessageGql)
  @RequirePermissions('chat.use')
  @Throttle(PER_MINUTE(30))
  sendChatMessage(@WorkspaceIdArg() _w: string, @Args('input') input: SendChatMessageInput, @CurrentActor() actor: Actor, @CurrentAccess() access: WorkspaceAccess): Promise<ChatMessageGql> {
    return this.service.send(actor, access, input);
  }

  @Mutation(() => ChatMessageGql)
  @RequirePermissions('chat.use')
  @Throttle(PER_MINUTE(30))
  editChatMessage(
    @WorkspaceIdArg() _w: string,
    @UuidArg('messageId') messageId: string,
    @Args('body', { type: () => String }) body: string,
    @CurrentActor() actor: Actor,
    @CurrentAccess() access: WorkspaceAccess,
  ): Promise<ChatMessageGql> {
    return this.service.edit(actor, access, messageId, body);
  }

  @Mutation(() => Boolean)
  @RequirePermissions('chat.use')
  deleteChatMessage(@WorkspaceIdArg() _w: string, @UuidArg('messageId') messageId: string, @CurrentActor() actor: Actor, @CurrentAccess() access: WorkspaceAccess): Promise<boolean> {
    return this.service.remove(actor, access, messageId);
  }

  @Mutation(() => ChatMessageGql, { description: 'Adds your reaction, or removes it if it is already there' })
  @RequirePermissions('chat.use')
  @Throttle(PER_MINUTE(60))
  toggleChatReaction(
    @WorkspaceIdArg() _w: string,
    @UuidArg('messageId') messageId: string,
    @Args('emoji', { type: () => String }) emoji: string,
    @CurrentActor() actor: Actor,
    @CurrentAccess() access: WorkspaceAccess,
  ): Promise<ChatMessageGql> {
    return this.service.react(actor, access, messageId, emoji.slice(0, 16));
  }

  @Mutation(() => Boolean, { description: 'Tells the channel you are typing. A live signal only; nothing is stored' })
  @RequirePermissions('chat.use')
  @Throttle(PER_MINUTE(40))
  chatTyping(@WorkspaceIdArg() _w: string, @UuidArg('channelId') channelId: string, @CurrentActor() actor: Actor, @CurrentAccess() access: WorkspaceAccess): Promise<boolean> {
    return this.service.typing(actor, access, channelId);
  }

  @Mutation(() => ChatMessageGql, { description: 'Creates a task from a message (needs task.create on the list) and notes it in the thread' })
  @RequirePermissions('chat.use', 'task.create')
  @Throttle(PER_MINUTE(20))
  createTaskFromChatMessage(
    @WorkspaceIdArg() _w: string,
    @Args('input') input: CreateTaskFromMessageInput,
    @CurrentActor() actor: Actor,
    @CurrentAccess() access: WorkspaceAccess,
  ): Promise<ChatMessageGql> {
    return this.service.createTaskFromMessage(actor, access, input);
  }
}
