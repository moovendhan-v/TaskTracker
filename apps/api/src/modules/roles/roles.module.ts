import { Module } from '@nestjs/common';
import { RolesService } from './application/roles.service.js';
import { WorkspaceRoleRepository } from './domain/workspace-role.repository.js';
import { TypeOrmWorkspaceRoleRepository } from './infrastructure/typeorm-workspace-role.repository.js';
import { RolesController } from './presentation/roles.controller.js';

@Module({
  controllers: [RolesController],
  providers: [RolesService, { provide: WorkspaceRoleRepository, useClass: TypeOrmWorkspaceRoleRepository }],
  exports: [RolesService],
})
export class RolesModule {}
