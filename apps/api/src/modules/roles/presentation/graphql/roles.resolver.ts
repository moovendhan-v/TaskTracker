import { Args, Mutation, Query, Resolver } from '@nestjs/graphql';
import { CurrentAccess } from '../../../../core/access/current-access.decorator.js';
import { RequirePermissions } from '../../../../core/access/require-permissions.decorator.js';
import { UuidArg, WorkspaceIdArg } from '../../../../core/graphql/args.js';
import { CurrentActor } from '../../../../core/http/decorators/current-actor.decorator.js';
import type { Actor, WorkspaceAccess } from '../../../../core/http/types/authenticated-request.js';
import { RolesService } from '../../application/roles.service.js';
import { CreateRoleInput, RoleGql, UpdateRoleInput } from './role.types.js';

@Resolver(() => RoleGql)
export class RolesResolver {
  constructor(private readonly rolesService: RolesService) {}

  @Query(() => [RoleGql])
  @RequirePermissions()
  roles(@WorkspaceIdArg() _workspaceId: string, @CurrentAccess() access: WorkspaceAccess): Promise<RoleGql[]> {
    return this.rolesService.list(access.workspaceId);
  }

  @Mutation(() => RoleGql)
  @RequirePermissions('roles.manage')
  createRole(
    @WorkspaceIdArg() _workspaceId: string,
    @Args('input') input: CreateRoleInput,
    @CurrentActor() actor: Actor,
    @CurrentAccess() access: WorkspaceAccess,
  ): Promise<RoleGql> {
    return this.rolesService.create(actor, access, input);
  }

  @Mutation(() => RoleGql)
  @RequirePermissions('roles.manage')
  updateRole(
    @WorkspaceIdArg() _workspaceId: string,
    @UuidArg('roleId') roleId: string,
    @Args('input') input: UpdateRoleInput,
    @CurrentActor() actor: Actor,
    @CurrentAccess() access: WorkspaceAccess,
  ): Promise<RoleGql> {
    return this.rolesService.update(actor, access, roleId, input);
  }

  @Mutation(() => Boolean)
  @RequirePermissions('roles.manage')
  async deleteRole(
    @WorkspaceIdArg() _workspaceId: string,
    @UuidArg('roleId') roleId: string,
    @CurrentActor() actor: Actor,
    @CurrentAccess() access: WorkspaceAccess,
  ): Promise<boolean> {
    await this.rolesService.remove(actor, access, roleId);
    return true;
  }
}
