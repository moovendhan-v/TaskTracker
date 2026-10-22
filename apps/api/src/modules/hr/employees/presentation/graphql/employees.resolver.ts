import { Args, ID, Mutation, Query, Resolver } from '@nestjs/graphql';
import { CurrentAccess } from '../../../../../core/access/current-access.decorator.js';
import { RequirePermissions } from '../../../../../core/access/require-permissions.decorator.js';
import { WorkspaceIdArg } from '../../../../../core/graphql/args.js';
import { cappedListComplexity } from '../../../../../core/graphql/page.type.js';
import { CurrentActor } from '../../../../../core/http/decorators/current-actor.decorator.js';
import type { Actor, WorkspaceAccess } from '../../../../../core/http/types/authenticated-request.js';
import { EmployeesService } from '../../application/employees.service.js';
import { EmployeeGql, EmployeeProfileInput } from './employee.types.js';

const DIRECTORY_LIMIT = 500;

@Resolver(() => EmployeeGql)
export class EmployeesResolver {
  constructor(private readonly employeesService: EmployeesService) {}

  @Query(() => [EmployeeGql], { complexity: cappedListComplexity(DIRECTORY_LIMIT), description: 'Current members with their HR profiles' })
  @RequirePermissions('hr.view')
  employees(@WorkspaceIdArg() _workspaceId: string, @CurrentAccess() access: WorkspaceAccess): Promise<EmployeeGql[]> {
    return this.employeesService.directory(access.workspaceId);
  }

  @Query(() => EmployeeGql)
  @RequirePermissions('hr.view')
  employee(
    @WorkspaceIdArg() _workspaceId: string,
    @Args('userId', { type: () => ID }) userId: string,
    @CurrentAccess() access: WorkspaceAccess,
  ): Promise<EmployeeGql> {
    return this.employeesService.get(access.workspaceId, userId);
  }

  @Mutation(() => EmployeeGql)
  @RequirePermissions('hr.manage')
  upsertEmployeeProfile(
    @WorkspaceIdArg() _workspaceId: string,
    @Args('userId', { type: () => ID }) userId: string,
    @Args('input') input: EmployeeProfileInput,
    @CurrentActor() actor: Actor,
    @CurrentAccess() access: WorkspaceAccess,
  ): Promise<EmployeeGql> {
    return this.employeesService.upsert(actor, access.workspaceId, userId, input);
  }
}
