import { Args, Query, Resolver } from '@nestjs/graphql';
import { CurrentAccess } from '../../../../core/access/current-access.decorator.js';
import { RequirePermissions } from '../../../../core/access/require-permissions.decorator.js';
import { WorkspaceIdArg } from '../../../../core/graphql/args.js';
import { ResourceSchemaGql } from '../../../../core/graphql/resource-query.types.js';
import type { WorkspaceAccess } from '../../../../core/http/types/authenticated-request.js';
import { ResourceSchemaService } from '../../application/resource-schema.service.js';

@Resolver(() => ResourceSchemaGql)
export class ResourceSchemaResolver {
  constructor(private readonly schemas: ResourceSchemaService) {}

  @Query(() => ResourceSchemaGql, { description: 'Fields, filter operators, sorting and paging a resource supports, for building tables and filters' })
  @RequirePermissions()
  resourceSchema(
    @WorkspaceIdArg() _workspaceId: string,
    @Args('resource') resource: string,
    @CurrentAccess() access: WorkspaceAccess,
  ): Promise<ResourceSchemaGql> {
    return this.schemas.describe(access, resource.slice(0, 64));
  }

  @Query(() => [String], { description: 'Resources the caller can list with resourceSchema' })
  @RequirePermissions()
  resourceNames(@WorkspaceIdArg() _workspaceId: string, @CurrentAccess() access: WorkspaceAccess): string[] {
    return this.schemas.available(access);
  }
}
