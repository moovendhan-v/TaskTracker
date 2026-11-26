import { Args, Mutation, Query, Resolver } from '@nestjs/graphql';
import { Throttle } from '@nestjs/throttler';
import { BUG_QA_STATES, type BugQaState } from '@taskflow/shared-types';
import { CurrentAccess } from '../../../../core/access/current-access.decorator.js';
import { RequirePermissions } from '../../../../core/access/require-permissions.decorator.js';
import { DomainError } from '../../../../core/domain/domain-error.js';
import { OptionalUuidArg, UuidArg, WorkspaceIdArg } from '../../../../core/graphql/args.js';
import { CurrentActor } from '../../../../core/http/decorators/current-actor.decorator.js';
import type { Actor, WorkspaceAccess } from '../../../../core/http/types/authenticated-request.js';
import { BugsService } from '../../application/bugs.service.js';
import { parseCapture } from '../../domain/parse-capture.js';

export { parseCapture };
import { BugFilterInput, BugGql, ReportBugInput, SimilarBugGql, UpdateBugInput } from './bugs.types.js';

const PER_MINUTE = (limit: number) => ({ default: { limit, ttl: 60_000 } });

/** E6 bug reports. Reading needs task.view in the project; reporting task.create; changing task.update. */
@Resolver(() => BugGql)
export class BugsResolver {
  constructor(private readonly service: BugsService) {}

  @Query(() => [BugGql], { description: 'Bug reports and feedback of a project, most severe first' })
  @RequirePermissions('task.view')
  bugs(@WorkspaceIdArg() _workspaceId: string, @UuidArg('spaceId') spaceId: string, @Args('filter', { type: () => BugFilterInput, nullable: true }) filter: BugFilterInput | null, @CurrentAccess() access: WorkspaceAccess): Promise<BugGql[]> {
    return this.service.list(access, spaceId, filter ?? {});
  }

  @Query(() => BugGql)
  @RequirePermissions('task.view')
  bug(@WorkspaceIdArg() _workspaceId: string, @UuidArg('taskId') taskId: string, @CurrentAccess() access: WorkspaceAccess): Promise<BugGql> {
    return this.service.get(access, taskId);
  }

  @Query(() => String, { description: 'The report’s captured console, network and actions as JSON (already redacted)' })
  @RequirePermissions('task.view')
  async bugCapture(@WorkspaceIdArg() _workspaceId: string, @UuidArg('taskId') taskId: string, @CurrentAccess() access: WorkspaceAccess): Promise<string> {
    return JSON.stringify(await this.service.capture(access, taskId));
  }

  @Query(() => [SimilarBugGql], { description: 'Reports in the project with a similar title, for spotting duplicates' })
  @RequirePermissions('task.view')
  @Throttle(PER_MINUTE(60))
  similarBugs(
    @WorkspaceIdArg() _workspaceId: string,
    @UuidArg('spaceId') spaceId: string,
    @Args('title') title: string,
    @OptionalUuidArg('excludeTaskId') excludeTaskId: string | null,
    @CurrentAccess() access: WorkspaceAccess,
  ): Promise<SimilarBugGql[]> {
    return this.service.similar(access, spaceId, title, excludeTaskId);
  }

  @Mutation(() => BugGql, { description: 'File a bug report or feedback (creates a task of type bug)' })
  @RequirePermissions('task.create')
  @Throttle(PER_MINUTE(20))
  reportBug(@WorkspaceIdArg() _workspaceId: string, @Args('input') input: ReportBugInput, @CurrentActor() actor: Actor, @CurrentAccess() access: WorkspaceAccess): Promise<BugGql> {
    const { captureJson, ...rest } = input;
    return this.service.report(actor, access, { ...rest, capture: parseCapture(captureJson) });
  }

  @Mutation(() => BugGql)
  @RequirePermissions('task.update')
  @Throttle(PER_MINUTE(60))
  updateBug(@WorkspaceIdArg() _workspaceId: string, @UuidArg('taskId') taskId: string, @Args('input') input: UpdateBugInput, @CurrentActor() actor: Actor, @CurrentAccess() access: WorkspaceAccess): Promise<BugGql> {
    return this.service.update(actor, access, taskId, input);
  }

  @Mutation(() => BugGql, { description: 'Confirm, mark fixed, ask for a retest, verify, reopen or close' })
  @RequirePermissions('task.update')
  @Throttle(PER_MINUTE(60))
  setBugQaState(@WorkspaceIdArg() _workspaceId: string, @UuidArg('taskId') taskId: string, @Args('state') state: string, @CurrentActor() actor: Actor, @CurrentAccess() access: WorkspaceAccess): Promise<BugGql> {
    if (!(BUG_QA_STATES as readonly string[]).includes(state)) throw DomainError.invalid('Unknown QA state');
    return this.service.setQaState(actor, access, taskId, state as BugQaState);
  }

  @Mutation(() => BugGql, { description: 'Link a report to the one it duplicates and close it as a duplicate' })
  @RequirePermissions('task.update')
  @Throttle(PER_MINUTE(30))
  markBugDuplicate(@WorkspaceIdArg() _workspaceId: string, @UuidArg('taskId') taskId: string, @UuidArg('ofTaskId') ofTaskId: string, @CurrentActor() actor: Actor, @CurrentAccess() access: WorkspaceAccess): Promise<BugGql> {
    return this.service.markDuplicate(actor, access, taskId, ofTaskId);
  }
}
