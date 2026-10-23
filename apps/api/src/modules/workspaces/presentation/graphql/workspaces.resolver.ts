import { Args, Mutation, Query, Resolver } from '@nestjs/graphql';
import { CurrentAccess } from '../../../../core/access/current-access.decorator.js';
import { RequirePermissions } from '../../../../core/access/require-permissions.decorator.js';
import { WorkspaceIdArg } from '../../../../core/graphql/args.js';
import { CurrentActor } from '../../../../core/http/decorators/current-actor.decorator.js';
import type { Actor, WorkspaceAccess } from '../../../../core/http/types/authenticated-request.js';
import { WorkspacesService } from '../../application/workspaces.service.js';
import { CreateWorkspaceInput, UpdateWorkspaceInput, WorkspaceGql } from './workspace.types.js';

@Resolver(() => WorkspaceGql)
export class WorkspacesResolver {
  constructor(private readonly workspacesService: WorkspacesService) {}

  @Query(() => [WorkspaceGql], { description: 'Workspaces the caller belongs to' })
  workspaces(@CurrentActor() actor: Actor): Promise<WorkspaceGql[]> {
    return this.workspacesService.listForUser(actor.userId);
  }

  @Query(() => WorkspaceGql)
  @RequirePermissions()
  workspace(@WorkspaceIdArg() _workspaceId: string, @CurrentActor() actor: Actor, @CurrentAccess() access: WorkspaceAccess): Promise<WorkspaceGql> {
    return this.workspacesService.get(access, actor.userId);
  }

  @Mutation(() => WorkspaceGql)
  createWorkspace(@CurrentActor() actor: Actor, @Args('input') input: CreateWorkspaceInput): Promise<WorkspaceGql> {
    return this.workspacesService.create(actor, input);
  }

  @Mutation(() => WorkspaceGql)
  @RequirePermissions('workspace.manage')
  updateWorkspace(
    @WorkspaceIdArg() _workspaceId: string,
    @Args('input') input: UpdateWorkspaceInput,
    @CurrentActor() actor: Actor,
    @CurrentAccess() access: WorkspaceAccess,
  ): Promise<WorkspaceGql> {
    return this.workspacesService.update(actor, access, input);
  }

  @Mutation(() => Boolean)
  @RequirePermissions('workspace.manage')
  async deleteWorkspace(@WorkspaceIdArg() _workspaceId: string, @CurrentActor() actor: Actor, @CurrentAccess() access: WorkspaceAccess): Promise<boolean> {
    await this.workspacesService.remove(actor, access);
    return true;
  }
}
