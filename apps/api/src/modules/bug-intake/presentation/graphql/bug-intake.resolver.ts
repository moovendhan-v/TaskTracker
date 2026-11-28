import { Args, Int, Mutation, Query, Resolver } from '@nestjs/graphql';
import { Throttle } from '@nestjs/throttler';
import { CurrentAccess } from '../../../../core/access/current-access.decorator.js';
import { RequirePermissions } from '../../../../core/access/require-permissions.decorator.js';
import { UuidArg, WorkspaceIdArg } from '../../../../core/graphql/args.js';
import { CurrentActor } from '../../../../core/http/decorators/current-actor.decorator.js';
import type { Actor, WorkspaceAccess } from '../../../../core/http/types/authenticated-request.js';
import { BugIntakeService } from '../../application/bug-intake.service.js';
import { BugSharesService } from '../../application/bug-shares.service.js';
import { BugIntakeGql, BugShareGql, CreatedBugShareGql, SaveBugIntakeInput } from './bug-intake.types.js';

const PER_MINUTE = (limit: number) => ({ default: { limit, ttl: 60_000 } });

/** Project feedback settings (space.manage) and read-only report links (task.update to make). */
@Resolver(() => BugIntakeGql)
export class BugIntakeResolver {
  constructor(
    private readonly intake: BugIntakeService,
    private readonly shares: BugSharesService,
  ) {}

  @Query(() => BugIntakeGql, { nullable: true })
  @RequirePermissions('space.manage')
  bugIntake(@WorkspaceIdArg() _w: string, @UuidArg('spaceId') spaceId: string, @CurrentAccess() access: WorkspaceAccess): Promise<BugIntakeGql | null> {
    return this.intake.get(access, spaceId);
  }

  @Mutation(() => BugIntakeGql, { description: 'Turns the feedback widget and portal on or off for a project, and sets their sites and texts' })
  @RequirePermissions('space.manage')
  @Throttle(PER_MINUTE(20))
  saveBugIntake(@WorkspaceIdArg() _w: string, @UuidArg('spaceId') spaceId: string, @Args('input') input: SaveBugIntakeInput, @CurrentActor() actor: Actor, @CurrentAccess() access: WorkspaceAccess): Promise<BugIntakeGql> {
    return this.intake.save(actor, access, spaceId, input);
  }

  @Mutation(() => BugIntakeGql, { description: 'Replaces the public key; the old one stops working' })
  @RequirePermissions('space.manage')
  @Throttle(PER_MINUTE(5))
  rotateBugIntakeKey(@WorkspaceIdArg() _w: string, @UuidArg('spaceId') spaceId: string, @CurrentActor() actor: Actor, @CurrentAccess() access: WorkspaceAccess): Promise<BugIntakeGql> {
    return this.intake.rotate(actor, access, spaceId);
  }

  @Query(() => [BugShareGql], { description: 'Active read-only links to a report' })
  @RequirePermissions('task.view')
  bugShares(@WorkspaceIdArg() _w: string, @UuidArg('taskId') taskId: string, @CurrentAccess() access: WorkspaceAccess): Promise<BugShareGql[]> {
    return this.shares.list(access, taskId);
  }

  @Mutation(() => CreatedBugShareGql, { description: 'A read-only link to a report for someone outside the workspace' })
  @RequirePermissions('task.update')
  @Throttle(PER_MINUTE(10))
  createBugShare(
    @WorkspaceIdArg() _w: string,
    @UuidArg('taskId') taskId: string,
    @Args('days', { type: () => Int }) days: number,
    @CurrentActor() actor: Actor,
    @CurrentAccess() access: WorkspaceAccess,
  ): Promise<CreatedBugShareGql> {
    return this.shares.create(actor, access, taskId, 'full', days);
  }

  @Mutation(() => Boolean)
  @RequirePermissions('task.update')
  @Throttle(PER_MINUTE(30))
  revokeBugShare(@WorkspaceIdArg() _w: string, @UuidArg('shareId') shareId: string, @CurrentActor() actor: Actor, @CurrentAccess() access: WorkspaceAccess): Promise<boolean> {
    return this.shares.revoke(actor, access, shareId);
  }
}
