import { Args, Field, ID, InputType, Int, Mutation, ObjectType, Query, Resolver } from '@nestjs/graphql';
import { Throttle } from '@nestjs/throttler';
import { IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';
import type { AccessReason, AccessVerdict, Permission } from '@taskflow/shared-types';
import { CurrentAccess } from '../../../../core/access/current-access.decorator.js';
import { RequirePermissions } from '../../../../core/access/require-permissions.decorator.js';
import { WorkspaceIdArg } from '../../../../core/graphql/args.js';
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

/** The access checker and access requests (E3). */
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
}

