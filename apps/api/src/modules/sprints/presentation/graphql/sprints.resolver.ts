import { Args, Mutation, Query, Resolver } from '@nestjs/graphql';
import { CurrentAccess } from '../../../../core/access/current-access.decorator.js';
import { RequirePermissions } from '../../../../core/access/require-permissions.decorator.js';
import { OptionalUuidArg, UuidArg, WorkspaceIdArg } from '../../../../core/graphql/args.js';
import { CurrentActor } from '../../../../core/http/decorators/current-actor.decorator.js';
import type { Actor, WorkspaceAccess } from '../../../../core/http/types/authenticated-request.js';
import { SprintsService } from '../../application/sprints.service.js';
import { CompleteSprintMovesInput, CreateSprintInput, SprintGql, SprintReportGql, UpdateSprintInput } from './sprint.types.js';

@Resolver(() => SprintGql)
export class SprintsResolver {
  constructor(private readonly sprintsService: SprintsService) {}

  @Query(() => [SprintGql])
  @RequirePermissions('task.view')
  sprints(@WorkspaceIdArg() _workspaceId: string, @UuidArg('spaceId') spaceId: string, @CurrentAccess() access: WorkspaceAccess): Promise<SprintGql[]> {
    return this.sprintsService.listInSpace(access.workspaceId, spaceId);
  }

  @Query(() => SprintGql)
  @RequirePermissions('task.view')
  sprint(@WorkspaceIdArg() _workspaceId: string, @UuidArg('sprintId') sprintId: string, @CurrentAccess() access: WorkspaceAccess): Promise<SprintGql> {
    return this.sprintsService.get(access.workspaceId, sprintId);
  }

  @Query(() => SprintReportGql, { description: 'Committed vs delivered, with scope added or removed mid-sprint; needs task.view in the sprint’s space' })
  @RequirePermissions('task.view')
  sprintReport(@WorkspaceIdArg() _workspaceId: string, @UuidArg('sprintId') sprintId: string, @CurrentAccess() access: WorkspaceAccess): Promise<SprintReportGql> {
    return this.sprintsService.report(access.workspaceId, sprintId);
  }

  @Mutation(() => SprintGql)
  @RequirePermissions('sprint.manage')
  createSprint(
    @WorkspaceIdArg() _workspaceId: string,
    @UuidArg('spaceId') spaceId: string,
    @Args('input') input: CreateSprintInput,
    @CurrentActor() actor: Actor,
    @CurrentAccess() access: WorkspaceAccess,
  ): Promise<SprintGql> {
    return this.sprintsService.create(actor, access.workspaceId, spaceId, input);
  }

  @Mutation(() => SprintGql)
  @RequirePermissions('sprint.manage')
  updateSprint(
    @WorkspaceIdArg() _workspaceId: string,
    @UuidArg('sprintId') sprintId: string,
    @Args('input') input: UpdateSprintInput,
    @CurrentActor() actor: Actor,
    @CurrentAccess() access: WorkspaceAccess,
  ): Promise<SprintGql> {
    return this.sprintsService.update(actor, access.workspaceId, sprintId, input);
  }

  @Mutation(() => Boolean)
  @RequirePermissions('sprint.manage')
  async deleteSprint(
    @WorkspaceIdArg() _workspaceId: string,
    @UuidArg('sprintId') sprintId: string,
    @CurrentActor() actor: Actor,
    @CurrentAccess() access: WorkspaceAccess,
  ): Promise<boolean> {
    await this.sprintsService.remove(actor, access.workspaceId, sprintId);
    return true;
  }

  @Mutation(() => SprintGql)
  @RequirePermissions('sprint.manage')
  startSprint(
    @WorkspaceIdArg() _workspaceId: string,
    @UuidArg('sprintId') sprintId: string,
    @CurrentActor() actor: Actor,
    @CurrentAccess() access: WorkspaceAccess,
  ): Promise<SprintGql> {
    return this.sprintsService.start(actor, access.workspaceId, sprintId);
  }

  @Mutation(() => SprintGql, { description: 'Unfinished tasks move to another planned sprint in the space, or to the backlog when omitted' })
  @RequirePermissions('sprint.manage')
  completeSprint(
    @WorkspaceIdArg() _workspaceId: string,
    @UuidArg('sprintId') sprintId: string,
    @OptionalUuidArg('moveOpenTasksToSprintId') target: string | null | undefined,
    @Args('rollover', { type: () => CompleteSprintMovesInput, nullable: true, description: 'Per-task destinations for unfinished tasks' }) rollover: CompleteSprintMovesInput | null | undefined,
    @CurrentActor() actor: Actor,
    @CurrentAccess() access: WorkspaceAccess,
  ): Promise<SprintGql> {
    return this.sprintsService.complete(actor, access.workspaceId, sprintId, { moveOpenTasksToSprintId: target ?? null, moves: rollover?.moves ?? [] });
  }
}
