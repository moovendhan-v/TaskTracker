import { Module } from '@nestjs/common';
import { MembersModule } from '../members/members.module.js';
import { RolesModule } from '../roles/roles.module.js';
import { WorkspacesService } from './application/workspaces.service.js';
import { WorkspaceRepository } from './domain/workspace.repository.js';
import { TypeOrmWorkspaceRepository } from './infrastructure/typeorm-workspace.repository.js';
import { WorkspacesResolver } from './presentation/graphql/workspaces.resolver.js';
import { WorkspacesController } from './presentation/workspaces.controller.js';

@Module({
  imports: [RolesModule, MembersModule],
  controllers: [WorkspacesController],
  providers: [WorkspacesService, WorkspacesResolver, { provide: WorkspaceRepository, useClass: TypeOrmWorkspaceRepository }],
})
export class WorkspacesModule {}
