import { Args, Mutation, Query, Resolver } from '@nestjs/graphql';
import { CurrentAccess } from '../../../../core/access/current-access.decorator.js';
import { RequirePermissions } from '../../../../core/access/require-permissions.decorator.js';
import { UuidArg, WorkspaceIdArg } from '../../../../core/graphql/args.js';
import { CurrentActor } from '../../../../core/http/decorators/current-actor.decorator.js';
import type { Actor, WorkspaceAccess } from '../../../../core/http/types/authenticated-request.js';
import { ListsService } from '../../application/lists.service.js';
import { TaskListGql, TaskListInput } from './task-list.types.js';

@Resolver(() => TaskListGql)
export class ListsResolver {
  constructor(private readonly listsService: ListsService) {}

  @Query(() => [TaskListGql], { description: 'Every list in the workspace' })
  @RequirePermissions()
  lists(@WorkspaceIdArg() _workspaceId: string, @CurrentAccess() access: WorkspaceAccess): Promise<TaskListGql[]> {
    return this.listsService.listForWorkspace(access.workspaceId);
  }

  @Mutation(() => TaskListGql)
  @RequirePermissions('list.manage')
  createList(
    @WorkspaceIdArg() _workspaceId: string,
    @UuidArg('spaceId') spaceId: string,
    @Args('input') input: TaskListInput,
    @CurrentActor() actor: Actor,
    @CurrentAccess() access: WorkspaceAccess,
  ): Promise<TaskListGql> {
    return this.listsService.create(actor, access.workspaceId, spaceId, input);
  }

  @Mutation(() => TaskListGql)
  @RequirePermissions('list.manage')
  updateList(
    @WorkspaceIdArg() _workspaceId: string,
    @UuidArg('listId') listId: string,
    @Args('input') input: TaskListInput,
    @CurrentActor() actor: Actor,
    @CurrentAccess() access: WorkspaceAccess,
  ): Promise<TaskListGql> {
    return this.listsService.update(actor, access.workspaceId, listId, input);
  }

  @Mutation(() => Boolean)
  @RequirePermissions('list.manage')
  async deleteList(
    @WorkspaceIdArg() _workspaceId: string,
    @UuidArg('listId') listId: string,
    @CurrentActor() actor: Actor,
    @CurrentAccess() access: WorkspaceAccess,
  ): Promise<boolean> {
    await this.listsService.remove(actor, access.workspaceId, listId);
    return true;
  }
}
