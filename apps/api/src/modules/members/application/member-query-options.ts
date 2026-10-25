import { Injectable, type OnModuleInit } from '@nestjs/common';
import { EnumOptionsRegistry } from '../../../core/query/enum-options.registry.js';
import { RolesService } from '../../roles/application/roles.service.js';

/** Publishes the workspace's roles as the options of the members table's Role column. */
@Injectable()
export class MemberQueryOptions implements OnModuleInit {
  constructor(
    private readonly registry: EnumOptionsRegistry,
    private readonly rolesService: RolesService,
  ) {}

  onModuleInit(): void {
    this.registry.register('members', 'roleId', async (workspaceId) =>
      (await this.rolesService.list(workspaceId)).map((role) => ({ value: role.id, label: role.name })),
    );
  }
}
