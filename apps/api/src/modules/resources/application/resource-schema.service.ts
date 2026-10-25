import { Injectable } from '@nestjs/common';
import type { ResourceSchema } from '@taskflow/shared-types';
import { Cached } from '../../../core/cache/cached.decorator.js';
import { DomainError } from '../../../core/domain/domain-error.js';
import type { WorkspaceAccess } from '../../../core/http/types/authenticated-request.js';
import { EnumOptionsRegistry } from '../../../core/query/enum-options.registry.js';
import { allQueryResources, findQueryResource } from '../../../core/query/query-resource.decorators.js';
import { describeResource } from '../../../core/query/resource-schema.js';

/** Publishes query resources to clients, trimmed to what the caller may see. */
@Injectable()
export class ResourceSchemaService {
  constructor(private readonly enumOptions: EnumOptionsRegistry) {}

  /** Cached per workspace and permission set: everyone with the same role sees the same schema. */
  @Cached({ entities: ['status', 'role', 'policy'], shared: true, workspace: (access: WorkspaceAccess) => access.workspaceId })
  async describe(access: WorkspaceAccess, resource: string): Promise<ResourceSchema> {
    const definition = findQueryResource(resource);
    // Unknown and forbidden look the same, so the list of resources isn't revealed.
    if (!definition || !canList(access, definition.permission)) throw DomainError.notFound('Resource');
    return describeResource(definition, access, await this.enumOptions.optionsFor(resource, access.workspaceId));
  }

  /** Names of the resources the caller may list. */
  available(access: WorkspaceAccess): string[] {
    return allQueryResources()
      .filter((definition) => canList(access, definition.permission))
      .map((definition) => definition.name)
      .sort();
  }
}

function canList(access: WorkspaceAccess, permission: string | null): boolean {
  return permission === null || access.permissions.has(permission as never);
}
