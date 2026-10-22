import { Module } from '@nestjs/common';
import { PlatformAdminGuard } from '../../core/access/platform-admin.guard.js';
import { AuditLogModule } from '../audit-log/audit-log.module.js';
import { AdminUsersService } from './application/admin-users.service.js';
import { AdminWorkspacesService } from './application/admin-workspaces.service.js';
import { AdminUserRepository } from './domain/admin-user.repository.js';
import { AdminWorkspaceRepository } from './domain/admin-workspace.repository.js';
import { TypeOrmAdminUserRepository } from './infrastructure/typeorm-admin-user.repository.js';
import { TypeOrmAdminWorkspaceRepository } from './infrastructure/typeorm-admin-workspace.repository.js';
import { AdminAuditController } from './presentation/admin-audit.controller.js';
import { AdminUsersController } from './presentation/admin-users.controller.js';
import { AdminWorkspacesController } from './presentation/admin-workspaces.controller.js';

/** SUPER_ADMIN console. Every route is behind PlatformAdminGuard. */
@Module({
  imports: [AuditLogModule],
  controllers: [AdminUsersController, AdminWorkspacesController, AdminAuditController],
  providers: [
    PlatformAdminGuard,
    AdminUsersService,
    AdminWorkspacesService,
    { provide: AdminUserRepository, useClass: TypeOrmAdminUserRepository },
    { provide: AdminWorkspaceRepository, useClass: TypeOrmAdminWorkspaceRepository },
  ],
})
export class AdminModule {}
