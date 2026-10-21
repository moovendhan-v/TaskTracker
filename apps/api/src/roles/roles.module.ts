import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { WorkspaceMemberEntity } from '../members/workspace-member.entity.js';
import { WorkspaceRoleEntity } from './entities/workspace-role.entity.js';
import { RolesController } from './roles.controller.js';
import { RolesService } from './roles.service.js';

@Module({
  imports: [TypeOrmModule.forFeature([WorkspaceRoleEntity, WorkspaceMemberEntity])],
  controllers: [RolesController],
  providers: [RolesService],
})
export class RolesModule {}
