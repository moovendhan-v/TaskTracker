import { Module } from '@nestjs/common';
import { PlatformAdminGuard } from '../../core/access/platform-admin.guard.js';
import { AuditLogModule } from '../audit-log/audit-log.module.js';
import { AdminUsersService } from './application/admin-users.service.js';
import { AdminWorkspacesService } from './application/admin-workspaces.service.js';
import { AdminUserRepository } from './domain/admin-user.repository.js';
import { AdminWorkspaceRepository } from './domain/admin-workspace.repository.js';
import { TypeOrmAdminUserRepository } from './infrastructure/typeorm-admin-user.repository.js';
import { TypeOrmAdminWorkspaceRepository } from './infrastructure/typeorm-admin-workspace.repository.js';
import { AdminResolver } from './presentation/graphql/admin.resolver.js';

/** SUPER_ADMIN console. Every route is behind PlatformAdminGuard. */
@Module({
  imports: [AuditLogModule],
  providers: [
    PlatformAdminGuard,
    AdminUsersService,
    AdminWorkspacesService,
    AdminResolver,
    { provide: AdminUserRepository, useClass: TypeOrmAdminUserRepository },
    { provide: AdminWorkspaceRepository, useClass: TypeOrmAdminWorkspaceRepository },
  ],
})
export class AdminModule {}
