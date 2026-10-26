import { Module } from '@nestjs/common';
import { PoliciesService } from './application/policies.service.js';
import { RoleAccessService } from './application/role-access.service.js';
import { RolesService } from './application/roles.service.js';
import { PolicyRepository } from './domain/policy.repository.js';
import { WorkspaceRoleRepository } from './domain/workspace-role.repository.js';
import { TypeOrmPolicyRepository } from './infrastructure/typeorm-policy.repository.js';
import { TypeOrmWorkspaceRoleRepository } from './infrastructure/typeorm-workspace-role.repository.js';
import { PoliciesResolver } from './presentation/graphql/policies.resolver.js';
import { RolesResolver } from './presentation/graphql/roles.resolver.js';

@Module({
  providers: [
    RolesService,
    RoleAccessService,
    PoliciesService,
    RolesResolver,
    PoliciesResolver,
    { provide: WorkspaceRoleRepository, useClass: TypeOrmWorkspaceRoleRepository },
    { provide: PolicyRepository, useClass: TypeOrmPolicyRepository },
  ],
  exports: [RolesService, RoleAccessService],
})
export class RolesModule {}
