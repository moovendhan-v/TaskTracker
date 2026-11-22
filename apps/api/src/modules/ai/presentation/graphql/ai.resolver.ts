import { Args, Mutation, Query, Resolver } from '@nestjs/graphql';
import { Throttle } from '@nestjs/throttler';
import { CurrentAccess } from '../../../../core/access/current-access.decorator.js';
import { RequirePermissions } from '../../../../core/access/require-permissions.decorator.js';
import { OptionalUuidArg, UuidArg, WorkspaceIdArg } from '../../../../core/graphql/args.js';
import { CurrentActor } from '../../../../core/http/decorators/current-actor.decorator.js';
import type { Actor, WorkspaceAccess } from '../../../../core/http/types/authenticated-request.js';
import { AiAssistantService } from '../../application/ai-assistant.service.js';
import { AiSettingsService } from '../../application/ai-settings.service.js';
import { AiSettingsGql, AiSummaryGql, UpdateAiSettingsInput } from './ai.types.js';

const PER_MINUTE = (limit: number) => ({ default: { limit, ttl: 60_000 } });

/**
 * E5 AI. Settings are read by any member and changed with workspace.manage (audited). Each
 * summary needs the permission that opens what it summarises, is rate limited, and counts
 * against the caller's daily token budget.
 */
@Resolver()
export class AiResolver {
  constructor(
    private readonly settings: AiSettingsService,
    private readonly assistant: AiAssistantService,
  ) {}

  @Query(() => AiSettingsGql, { description: 'Whether AI is on here, the configured providers and your usage today' })
  @RequirePermissions()
  aiSettings(@WorkspaceIdArg() _workspaceId: string, @CurrentActor() actor: Actor, @CurrentAccess() access: WorkspaceAccess): Promise<AiSettingsGql> {
    return this.settings.get(access, actor);
  }

  @Mutation(() => AiSettingsGql, { description: 'Turn AI on or off and pick a configured provider and model' })
  @RequirePermissions('workspace.manage')
  @Throttle(PER_MINUTE(20))
  updateAiSettings(@WorkspaceIdArg() _workspaceId: string, @Args('input') input: UpdateAiSettingsInput, @CurrentActor() actor: Actor, @CurrentAccess() access: WorkspaceAccess): Promise<AiSettingsGql> {
    return this.settings.update(actor, access, input);
  }

  @Mutation(() => AiSummaryGql, { description: 'Summarise a task with its comments' })
  @RequirePermissions('task.view')
  @Throttle(PER_MINUTE(10))
  summarizeTask(@WorkspaceIdArg() _workspaceId: string, @UuidArg('taskId') taskId: string, @CurrentActor() actor: Actor, @CurrentAccess() access: WorkspaceAccess): Promise<AiSummaryGql> {
    return this.assistant.summarize(actor, access, 'task', taskId);
  }

  @Mutation(() => AiSummaryGql, { description: 'Summarise a doc page' })
  @RequirePermissions('doc.view')
  @Throttle(PER_MINUTE(10))
  summarizeDocument(@WorkspaceIdArg() _workspaceId: string, @UuidArg('documentId') documentId: string, @CurrentActor() actor: Actor, @CurrentAccess() access: WorkspaceAccess): Promise<AiSummaryGql> {
    return this.assistant.summarize(actor, access, 'document', documentId);
  }

  @Mutation(() => AiSummaryGql, { description: 'Summarise a chat channel’s recent messages, or one thread' })
  @RequirePermissions('chat.use')
  @Throttle(PER_MINUTE(10))
  summarizeChat(
    @WorkspaceIdArg() _workspaceId: string,
    @UuidArg('channelId') channelId: string,
    @OptionalUuidArg('threadRootId') threadRootId: string | null,
    @CurrentActor() actor: Actor,
    @CurrentAccess() access: WorkspaceAccess,
  ): Promise<AiSummaryGql> {
    return this.assistant.summarize(actor, access, 'chat', channelId, threadRootId);
  }
}
