import { Field, ID, Mutation, ObjectType, Query, Resolver } from '@nestjs/graphql';
import type { ActiveCallResponse, CallJoinResponse, CallParticipantResponse, CallsOverviewResponse } from '@taskflow/shared-types';
import { CurrentAccess } from '../../../../core/access/current-access.decorator.js';
import { RequirePermissions } from '../../../../core/access/require-permissions.decorator.js';
import { UuidArg, WorkspaceIdArg } from '../../../../core/graphql/args.js';
import { CurrentActor } from '../../../../core/http/decorators/current-actor.decorator.js';
import { CurrentUser } from '../../../../core/http/decorators/current-user.decorator.js';
import type { Actor, SessionUser, WorkspaceAccess } from '../../../../core/http/types/authenticated-request.js';
import { CallsService } from '../../application/calls.service.js';

@ObjectType('CallParticipant')
class CallParticipantGql implements CallParticipantResponse {
  @Field(() => ID) userId: string;
  @Field() name: string;
}

@ObjectType('ActiveCall', { description: 'A call (huddle) going on now in a channel' })
class ActiveCallGql implements ActiveCallResponse {
  @Field(() => ID) id: string;
  @Field(() => ID) channelId: string;
  @Field(() => ID) startedById: string;
  @Field() startedAt: string;
  @Field(() => [CallParticipantGql]) participants: CallParticipantGql[];
}

@ObjectType('CallsOverview')
class CallsOverviewGql implements CallsOverviewResponse {
  @Field({ description: 'Whether calls are set up on this server' }) enabled: boolean;
  @Field(() => [ActiveCallGql], { description: 'Calls now, in channels you can read' }) calls: ActiveCallGql[];
}

@ObjectType('CallJoin', { description: 'Connect to `url` with `token` (valid for 10 minutes, for this one call)' })
class CallJoinGql implements CallJoinResponse {
  @Field(() => ID) callId: string;
  @Field(() => ID) channelId: string;
  @Field() url: string;
  @Field() token: string;
}

/** Calls in chat channels (D2). Everything needs chat.use; joining also needs to be able to post in the channel. */
@Resolver(() => CallsOverviewGql)
export class CallsResolver {
  constructor(private readonly calls: CallsService) {}

  @Query(() => CallsOverviewGql)
  @RequirePermissions('chat.use')
  callsOverview(@WorkspaceIdArg() _workspaceId: string, @CurrentAccess() access: WorkspaceAccess): Promise<CallsOverviewGql> {
    return this.calls.overview(access);
  }

  @Mutation(() => CallJoinGql, { description: "Joins the channel's call, starting one if none is going" })
  @RequirePermissions('chat.use')
  joinCall(
    @WorkspaceIdArg() _workspaceId: string,
    @UuidArg('channelId') channelId: string,
    @CurrentActor() actor: Actor,
    @CurrentUser() user: SessionUser,
    @CurrentAccess() access: WorkspaceAccess,
  ): Promise<CallJoinGql> {
    return this.calls.join(actor, user.name, access, channelId);
  }
}
