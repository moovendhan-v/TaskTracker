import { Module } from '@nestjs/common';
import { MembersModule } from '../members/members.module.js';
import { RolesModule } from '../roles/roles.module.js';
import { WorkspacesService } from './application/workspaces.service.js';
import { WorkspaceRepository } from './domain/workspace.repository.js';
import { TypeOrmWorkspaceRepository } from './infrastructure/typeorm-workspace.repository.js';
import { WorkspacesController } from './presentation/workspaces.controller.js';

@Module({
  imports: [RolesModule, MembersModule],
  controllers: [WorkspacesController],
  providers: [WorkspacesService, { provide: WorkspaceRepository, useClass: TypeOrmWorkspaceRepository }],
})
export class WorkspacesModule {}
