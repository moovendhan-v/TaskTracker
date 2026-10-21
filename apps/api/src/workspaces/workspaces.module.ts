import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { WorkspaceMemberEntity } from '../members/workspace-member.entity.js';
import { WorkspaceEntity } from './entities/workspace.entity.js';
import { WorkspacesController } from './workspaces.controller.js';
import { WorkspacesService } from './workspaces.service.js';

@Module({
  imports: [TypeOrmModule.forFeature([WorkspaceEntity, WorkspaceMemberEntity])],
  controllers: [WorkspacesController],
  providers: [WorkspacesService],
})
export class WorkspacesModule {}
