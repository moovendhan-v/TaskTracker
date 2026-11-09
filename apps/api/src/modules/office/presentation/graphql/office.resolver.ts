import { Args, Field, ID, Int, Mutation, ObjectType, Query, Resolver } from '@nestjs/graphql';
import { isOfficeChosenStatus, type OfficeChosenStatus, type OfficePersonResponse, type OfficeResponse, type OfficeStatus } from '@taskflow/shared-types';
import { CurrentAccess } from '../../../../core/access/current-access.decorator.js';
import { RequirePermissions } from '../../../../core/access/require-permissions.decorator.js';
import { DomainError } from '../../../../core/domain/domain-error.js';
import { WorkspaceIdArg } from '../../../../core/graphql/args.js';
import { CurrentActor } from '../../../../core/http/decorators/current-actor.decorator.js';
import type { Actor, WorkspaceAccess } from '../../../../core/http/types/authenticated-request.js';
import { OfficeService } from '../../application/office.service.js';

@ObjectType('OfficePerson')
class OfficePersonGql implements OfficePersonResponse {
  @Field(() => ID) userId: string;
  @Field() name: string;
  @Field(() => Int) x: number;
  @Field(() => Int) y: number;
  @Field(() => String, { description: 'available, focused, in_meeting, away or offline' }) status: OfficeStatus;
  @Field(() => String, { description: 'What they chose: available, focused or away' }) chosenStatus: OfficeChosenStatus;
  @Field(() => String, { nullable: true }) zoneId: string | null;
}

@ObjectType('Office', { description: 'The virtual office: who is where, and how they show' })
class OfficeGql implements OfficeResponse {
  @Field(() => ID) workspaceId: string;
  @Field(() => [OfficePersonGql]) people: OfficePersonGql[];
}

/** The virtual office (D3). Part of chat: everything needs chat.use. You only move and set yourself. */
@Resolver(() => OfficeGql)
export class OfficeResolver {
  constructor(private readonly service: OfficeService) {}

  @Query(() => OfficeGql)
  @RequirePermissions('chat.use')
  office(@WorkspaceIdArg() _workspaceId: string, @CurrentAccess() access: WorkspaceAccess): Promise<OfficeGql> {
    return this.service.get(access);
  }

  @Mutation(() => OfficePersonGql)
  @RequirePermissions('chat.use')
  moveInOffice(
    @WorkspaceIdArg() _workspaceId: string,
    @Args('x', { type: () => Int }) x: number,
    @Args('y', { type: () => Int }) y: number,
    @CurrentActor() actor: Actor,
    @CurrentAccess() access: WorkspaceAccess,
  ): Promise<OfficePersonGql> {
    return this.service.move(actor, access, x, y);
  }

  @Mutation(() => OfficePersonGql)
  @RequirePermissions('chat.use')
  setOfficeStatus(@WorkspaceIdArg() _workspaceId: string, @Args('status') status: string, @CurrentActor() actor: Actor, @CurrentAccess() access: WorkspaceAccess): Promise<OfficePersonGql> {
    if (!isOfficeChosenStatus(status)) throw DomainError.invalid('Status must be available, focused or away');
    return this.service.setStatus(actor, access, status);
  }

  @Mutation(() => OfficePersonGql, { description: 'A sign of life from the open office page, every minute' })
  @RequirePermissions('chat.use')
  officeHeartbeat(@WorkspaceIdArg() _workspaceId: string, @CurrentActor() actor: Actor, @CurrentAccess() access: WorkspaceAccess): Promise<OfficePersonGql> {
    return this.service.heartbeat(actor, access);
  }

  @Mutation(() => Boolean, { description: 'Leaving the office page: you show as offline at once' })
  @RequirePermissions('chat.use')
  leaveOffice(@WorkspaceIdArg() _workspaceId: string, @CurrentActor() actor: Actor, @CurrentAccess() access: WorkspaceAccess): Promise<boolean> {
    return this.service.leave(actor, access);
  }

  @Mutation(() => ID, { description: "A meeting room's channel (made the first time someone goes in)" })
  @RequirePermissions('chat.use')
  officeMeetingRoom(@WorkspaceIdArg() _workspaceId: string, @Args('zoneId') zoneId: string, @CurrentActor() actor: Actor, @CurrentAccess() access: WorkspaceAccess): Promise<string> {
    return this.service.meetingRoom(actor, access, zoneId.slice(0, 40));
  }
}
