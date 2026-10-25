import { Args, ID, Mutation, Query, Resolver } from '@nestjs/graphql';
import { CurrentAccess } from '../../../../core/access/current-access.decorator.js';
import { RequirePermissions } from '../../../../core/access/require-permissions.decorator.js';
import { UuidArg, WorkspaceIdArg } from '../../../../core/graphql/args.js';
import { CurrentActor } from '../../../../core/http/decorators/current-actor.decorator.js';
import type { Actor, WorkspaceAccess } from '../../../../core/http/types/authenticated-request.js';
import { UUID_LIST_PIPE } from '../../../../core/http/pipes/uuid.pipe.js';
import { StatusesService } from '../../application/statuses.service.js';
import { CreateTaskStatusInput, TaskStatusGql, UpdateTaskStatusInput } from './status.types.js';

@Resolver(() => TaskStatusGql)
export class StatusesResolver {
  constructor(private readonly statusesService: StatusesService) {}

  @Query(() => [TaskStatusGql], { description: "A space's statuses in display order" })
  @RequirePermissions('task.view')
  statuses(@WorkspaceIdArg() _workspaceId: string, @UuidArg('spaceId') spaceId: string, @CurrentAccess() access: WorkspaceAccess): Promise<TaskStatusGql[]> {
    return this.statusesService.listForSpace(access.workspaceId, spaceId);
  }

  @Query(() => [TaskStatusGql], { description: 'Every status in the workspace, for views across spaces' })
  @RequirePermissions('task.view')
  workspaceStatuses(@WorkspaceIdArg() _workspaceId: string, @CurrentAccess() access: WorkspaceAccess): Promise<TaskStatusGql[]> {
    return this.statusesService.listForWorkspace(access.workspaceId);
  }

  @Mutation(() => TaskStatusGql)
  @RequirePermissions('space.manage')
  createStatus(
    @WorkspaceIdArg() _workspaceId: string,
    @UuidArg('spaceId') spaceId: string,
    @Args('input') input: CreateTaskStatusInput,
    @CurrentActor() actor: Actor,
    @CurrentAccess() access: WorkspaceAccess,
  ): Promise<TaskStatusGql> {
    return this.statusesService.create(actor, access.workspaceId, spaceId, input);
  }

  @Mutation(() => TaskStatusGql)
  @RequirePermissions('space.manage')
  updateStatus(
    @WorkspaceIdArg() _workspaceId: string,
    @UuidArg('statusId') statusId: string,
    @Args('input') input: UpdateTaskStatusInput,
    @CurrentActor() actor: Actor,
    @CurrentAccess() access: WorkspaceAccess,
  ): Promise<TaskStatusGql> {
    return this.statusesService.update(actor, access.workspaceId, statusId, input);
  }

  @Mutation(() => Boolean, { description: "Deletes a status; its tasks move to `moveTasksTo` in the same space" })
  @RequirePermissions('space.manage')
  async deleteStatus(
    @WorkspaceIdArg() _workspaceId: string,
    @UuidArg('statusId') statusId: string,
    @UuidArg('moveTasksTo') moveTasksTo: string,
    @CurrentActor() actor: Actor,
    @CurrentAccess() access: WorkspaceAccess,
  ): Promise<boolean> {
    await this.statusesService.remove(actor, access.workspaceId, statusId, moveTasksTo);
    return true;
  }

  @Mutation(() => [TaskStatusGql])
  @RequirePermissions('space.manage')
  reorderStatuses(
    @WorkspaceIdArg() _workspaceId: string,
    @UuidArg('spaceId') spaceId: string,
    @Args('statusIds', { type: () => [ID] }, UUID_LIST_PIPE) statusIds: string[],
    @CurrentActor() actor: Actor,
    @CurrentAccess() access: WorkspaceAccess,
  ): Promise<TaskStatusGql[]> {
    return this.statusesService.reorder(actor, access.workspaceId, spaceId, statusIds.slice(0, 50));
  }
}
