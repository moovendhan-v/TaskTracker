import { Args, Field, ID, InputType, Int, Mutation, ObjectType, Query, Resolver } from '@nestjs/graphql';
import { Throttle } from '@nestjs/throttler';
import { IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';
import type { AccessGrantResponse, AccessReason, AccessRequestResponse, AccessRequestStatus, AccessVerdict, Permission } from '@taskflow/shared-types';
import { CurrentAccess } from '../../../../core/access/current-access.decorator.js';
import { RequirePermissions } from '../../../../core/access/require-permissions.decorator.js';
import { UuidArg, WorkspaceIdArg } from '../../../../core/graphql/args.js';
import { CurrentActor } from '../../../../core/http/decorators/current-actor.decorator.js';
import type { Actor, WorkspaceAccess } from '../../../../core/http/types/authenticated-request.js';
import { AccessReviewService } from '../../application/access-review.service.js';

@ObjectType('AccessReason')
class AccessReasonGql implements AccessReason {
  @Field(() => String, { description: 'allow or deny' }) effect: AccessReason['effect'];
  @Field({ description: 'Where the statement lives: the role itself or an attached policy' }) source: string;
  @Field({ description: 'The pattern that matched, e.g. task.*' }) pattern: string;
  @Field(() => String, { description: 'workspace, this-space or other-spaces' }) scope: AccessReason['scope'];
}

@ObjectType('AccessExplanation', { description: 'Why a member can or can’t do something' })
class AccessExplanationGql {
  @Field(() => ID) userId: string;
  @Field() roleName: string;
  @Field() permission: Permission;
  @Field(() => ID, { nullable: true }) spaceId: string | null;
  @Field() allowed: boolean;
  @Field(() => String, { description: 'allowed, not-granted, denied or denied-in-space' }) verdict: AccessVerdict;
  @Field(() => [AccessReasonGql]) reasons: AccessReasonGql[];
}

@InputType('RequestAccessInput')
class RequestAccessInput {
  @Field() @IsString() @MaxLength(60) permission: string;
  @Field(() => ID, { nullable: true }) @IsOptional() @IsUUID('4') spaceId?: string | null;
  @Field(() => String, { nullable: true }) @IsOptional() @IsString() @MaxLength(200) note?: string | null;
}

@ObjectType('AccessRequest', { description: 'Someone asking for access they don’t have' })
class AccessRequestGql implements AccessRequestResponse {
  @Field(() => ID) id: string;
  @Field(() => ID) requesterId: string;
  @Field() requesterName: string;
  @Field() permission: string;
  @Field(() => ID, { nullable: true }) spaceId: string | null;
  @Field(() => String, { nullable: true }) spaceName: string | null;
  @Field() note: string;
  @Field(() => String, { description: 'pending, approved or declined' }) status: AccessRequestStatus;
  @Field() createdAt: string;
}

@ObjectType('AccessGrant', { description: 'One permission for one person, in one project or the whole workspace, until it ends' })
class AccessGrantGql implements AccessGrantResponse {
  @Field(() => ID) id: string;
  @Field(() => ID) userId: string;
  @Field() userName: string;
  @Field() permission: string;
  @Field(() => ID, { nullable: true }) spaceId: string | null;
  @Field(() => String, { nullable: true }) spaceName: string | null;
  @Field() expiresAt: string;
  @Field(() => String, { nullable: true }) grantedByName: string | null;
  @Field() createdAt: string;
}

/** The access checker, access requests and the time-limited grants that approve them (E3). */
@Resolver()
export class AccessReviewResolver {
  constructor(private readonly review: AccessReviewService) {}

  @Query(() => AccessExplanationGql, { description: 'Why a member can or can’t do something, optionally in one space (the policy simulator)' })
  @RequirePermissions('roles.manage')
  @Throttle({ default: { limit: 60, ttl: 60_000 } })
  explainAccess(
    @WorkspaceIdArg() _workspaceId: string,
    @Args('userId', { type: () => ID }) userId: string,
    @Args('permission') permission: string,
    @Args('spaceId', { type: () => ID, nullable: true }) spaceId: string | null,
    @CurrentAccess() access: WorkspaceAccess,
  ): Promise<AccessExplanationGql> {
    return this.review.explain(access.workspaceId, userId.slice(0, 64), permission, spaceId);
  }

  @Query(() => AccessExplanationGql, { description: 'Why you can or can’t do something here' })
  @RequirePermissions()
  @Throttle({ default: { limit: 60, ttl: 60_000 } })
  explainMyAccess(
    @WorkspaceIdArg() _workspaceId: string,
    @Args('permission') permission: string,
    @Args('spaceId', { type: () => ID, nullable: true }) spaceId: string | null,
    @CurrentActor() actor: Actor,
    @CurrentAccess() access: WorkspaceAccess,
  ): Promise<AccessExplanationGql> {
    return this.review.explain(access.workspaceId, actor.userId, permission, spaceId);
  }

  @Mutation(() => Int, { description: 'Asks the people who manage roles for access; returns how many were asked' })
  @RequirePermissions()
  @Throttle({ default: { limit: 3, ttl: 600_000 } })
  requestAccess(@WorkspaceIdArg() _workspaceId: string, @Args('input') input: RequestAccessInput, @CurrentActor() actor: Actor, @CurrentAccess() access: WorkspaceAccess): Promise<number> {
    return this.review.request(actor, access, input);
  }

  @Query(() => [AccessRequestGql], { description: 'Requests waiting for someone who manages roles, newest first' })
  @RequirePermissions('roles.manage')
  accessRequests(@WorkspaceIdArg() _workspaceId: string, @CurrentAccess() access: WorkspaceAccess): Promise<AccessRequestGql[]> {
    return this.review.pendingRequests(access.workspaceId);
  }

  @Query(() => [AccessGrantGql], { description: 'Time-limited grants still running, soonest to end first' })
  @RequirePermissions('roles.manage')
  accessGrants(@WorkspaceIdArg() _workspaceId: string, @CurrentAccess() access: WorkspaceAccess): Promise<AccessGrantGql[]> {
    return this.review.activeGrants(access.workspaceId);
  }

  @Mutation(() => AccessRequestGql, { description: 'Approves a request for 1, 7 or 30 days (as a grant that ends), or declines it. Only for access you have yourself' })
  @RequirePermissions('roles.manage')
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  async decideAccessRequest(
    @WorkspaceIdArg() _workspaceId: string,
    @UuidArg('requestId') requestId: string,
    @Args('approve', { type: () => Boolean }) approve: boolean,
    @Args('days', { type: () => Int, nullable: true }) days: number | null,
    @CurrentActor() actor: Actor,
    @CurrentAccess() access: WorkspaceAccess,
  ): Promise<AccessRequestGql> {
    return (await this.review.decide(actor, access, requestId, approve, days)).request;
  }

  @Mutation(() => Boolean, { description: 'Ends a grant early' })
  @RequirePermissions('roles.manage')
  async revokeAccessGrant(@WorkspaceIdArg() _workspaceId: string, @UuidArg('grantId') grantId: string, @CurrentActor() actor: Actor, @CurrentAccess() access: WorkspaceAccess): Promise<boolean> {
    await this.review.revoke(actor, access, grantId);
    return true;
  }
}

