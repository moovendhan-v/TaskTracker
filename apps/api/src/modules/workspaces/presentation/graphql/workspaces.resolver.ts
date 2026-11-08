import { Args, Mutation, Query, Resolver } from '@nestjs/graphql';
import { CurrentAccess } from '../../../../core/access/current-access.decorator.js';
import { RequirePermissions } from '../../../../core/access/require-permissions.decorator.js';
import { WorkspaceIdArg } from '../../../../core/graphql/args.js';
import { CurrentActor } from '../../../../core/http/decorators/current-actor.decorator.js';
import type { Actor, WorkspaceAccess } from '../../../../core/http/types/authenticated-request.js';
import { WorkspacesService } from '../../application/workspaces.service.js';
import { isTwoStepRequirement } from '@taskflow/shared-types';
import { DomainError } from '../../../../core/domain/domain-error.js';
import { CreateWorkspaceInput, TwoStepPolicyGql, UpdateWorkspaceInput, WorkspaceGql } from './workspace.types.js';

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

  /** Every member may see it: the app tells people without two-step sign-in what they're missing. */
  @Query(() => TwoStepPolicyGql)
  @RequirePermissions()
  twoStepPolicy(@WorkspaceIdArg() _workspaceId: string, @CurrentActor() actor: Actor, @CurrentAccess() access: WorkspaceAccess): Promise<TwoStepPolicyGql> {
    return this.workspacesService.twoStepPolicy(access, actor.userId);
  }

  /** Requiring two-step sign-in changes what every member may do: workspace.manage, audited. */
  @Mutation(() => TwoStepPolicyGql)
  @RequirePermissions('workspace.manage')
  setTwoStepRequirement(
    @WorkspaceIdArg() _workspaceId: string,
    @Args('require', { type: () => String }) require: string,
    @CurrentActor() actor: Actor,
    @CurrentAccess() access: WorkspaceAccess,
  ): Promise<TwoStepPolicyGql> {
    if (!isTwoStepRequirement(require)) throw DomainError.invalid('Require two-step sign-in of: off, admins or everyone');
    return this.workspacesService.setTwoStep(actor, access, require);
  }

  @Mutation(() => Boolean)
  @RequirePermissions('workspace.manage')
  async deleteWorkspace(@WorkspaceIdArg() _workspaceId: string, @CurrentActor() actor: Actor, @CurrentAccess() access: WorkspaceAccess): Promise<boolean> {
    await this.workspacesService.remove(actor, access);
    return true;
  }
}
