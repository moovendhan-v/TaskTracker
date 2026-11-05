import { Args, Field, ID, Int, Mutation, ObjectType, Query, Resolver } from '@nestjs/graphql';
import { isChatRetentionDays, type ChatRetentionDays, type ChatRetentionResponse } from '@taskflow/shared-types';
import { CurrentAccess } from '../../../../core/access/current-access.decorator.js';
import { RequirePermissions } from '../../../../core/access/require-permissions.decorator.js';
import { WorkspaceIdArg } from '../../../../core/graphql/args.js';
import { CurrentActor } from '../../../../core/http/decorators/current-actor.decorator.js';
import type { Actor, WorkspaceAccess } from '../../../../core/http/types/authenticated-request.js';
import { DomainError } from '../../../../core/domain/domain-error.js';
import { ChatRetentionService } from '../../application/chat-retention.service.js';

@ObjectType('ChatRetention', { description: 'How long the workspace keeps chat; a thread is removed once its last message is older' })
export class ChatRetentionGql implements ChatRetentionResponse {
  @Field(() => ID) id: string;
  @Field(() => ID) workspaceId: string;
  @Field(() => Int, { nullable: true, description: 'Days to keep chat (30, 90, 180, 365 or 730); null keeps everything' }) days: ChatRetentionDays | null;
}

@Resolver(() => ChatRetentionGql)
export class ChatRetentionResolver {
  constructor(private readonly retention: ChatRetentionService) {}

  /** Everyone who chats can see how long chat is kept: it's shown in the channel list. */
  @Query(() => ChatRetentionGql)
  @RequirePermissions('chat.use')
  chatRetention(@WorkspaceIdArg() _workspaceId: string, @CurrentAccess() access: WorkspaceAccess): Promise<ChatRetentionGql> {
    return this.retention.get(access.workspaceId);
  }

  /** Deleting old chat for everyone is a workspace decision: workspace.manage, audited. */
  @Mutation(() => ChatRetentionGql)
  @RequirePermissions('workspace.manage')
  setChatRetention(
    @WorkspaceIdArg() _workspaceId: string,
    @Args('days', { type: () => Int, nullable: true }) days: number | null,
    @CurrentActor() actor: Actor,
    @CurrentAccess() access: WorkspaceAccess,
  ): Promise<ChatRetentionGql> {
    if (days !== null && !isChatRetentionDays(days)) throw DomainError.invalid('Keep chat for 30, 90, 180, 365 or 730 days, or forever');
    return this.retention.set(actor, access.workspaceId, days);
  }
}
