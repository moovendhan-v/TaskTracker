import { Global, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { WorkspaceMemberEntity } from '../members/workspace-member.entity.js';
import { WorkspaceEntity } from '../workspaces/entities/workspace.entity.js';
import { AccessService } from './access.service.js';
import { WorkspaceAccessGuard } from './workspace-access.guard.js';

@Global()
@Module({
  imports: [TypeOrmModule.forFeature([WorkspaceMemberEntity, WorkspaceEntity])],
  providers: [AccessService, WorkspaceAccessGuard],
  exports: [AccessService, WorkspaceAccessGuard],
})
export class AccessModule {}
