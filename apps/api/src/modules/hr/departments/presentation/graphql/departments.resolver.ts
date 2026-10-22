import { Args, Mutation, Query, Resolver } from '@nestjs/graphql';
import { CurrentAccess } from '../../../../../core/access/current-access.decorator.js';
import { RequirePermissions } from '../../../../../core/access/require-permissions.decorator.js';
import { UuidArg, WorkspaceIdArg } from '../../../../../core/graphql/args.js';
import { CurrentActor } from '../../../../../core/http/decorators/current-actor.decorator.js';
import type { Actor, WorkspaceAccess } from '../../../../../core/http/types/authenticated-request.js';
import { DepartmentsService } from '../../application/departments.service.js';
import { CreateDepartmentInput, DepartmentGql, UpdateDepartmentInput } from './department.types.js';

@Resolver(() => DepartmentGql)
export class DepartmentsResolver {
  constructor(private readonly departmentsService: DepartmentsService) {}

  @Query(() => [DepartmentGql])
  @RequirePermissions('hr.view')
  departments(@WorkspaceIdArg() _workspaceId: string, @CurrentAccess() access: WorkspaceAccess): Promise<DepartmentGql[]> {
    return this.departmentsService.list(access.workspaceId);
  }

  @Mutation(() => DepartmentGql)
  @RequirePermissions('hr.manage')
  createDepartment(
    @WorkspaceIdArg() _workspaceId: string,
    @Args('input') input: CreateDepartmentInput,
    @CurrentActor() actor: Actor,
    @CurrentAccess() access: WorkspaceAccess,
  ): Promise<DepartmentGql> {
    return this.departmentsService.create(actor, access.workspaceId, input);
  }

  @Mutation(() => DepartmentGql)
  @RequirePermissions('hr.manage')
  updateDepartment(
    @WorkspaceIdArg() _workspaceId: string,
    @UuidArg('departmentId') departmentId: string,
    @Args('input') input: UpdateDepartmentInput,
    @CurrentActor() actor: Actor,
    @CurrentAccess() access: WorkspaceAccess,
  ): Promise<DepartmentGql> {
    return this.departmentsService.update(actor, access.workspaceId, departmentId, input);
  }

  @Mutation(() => Boolean)
  @RequirePermissions('hr.manage')
  async deleteDepartment(
    @WorkspaceIdArg() _workspaceId: string,
    @UuidArg('departmentId') departmentId: string,
    @CurrentActor() actor: Actor,
    @CurrentAccess() access: WorkspaceAccess,
  ): Promise<boolean> {
    await this.departmentsService.remove(actor, access.workspaceId, departmentId);
    return true;
  }
}
