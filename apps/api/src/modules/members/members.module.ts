import { Module } from '@nestjs/common';
import { RolesModule } from '../roles/roles.module.js';
import { UsersModule } from '../users/users.module.js';
import { MembersService } from './application/members.service.js';
import { WorkspaceMemberRepository } from './domain/workspace-member.repository.js';
import { TypeOrmMembershipReader } from './infrastructure/typeorm-membership.reader.js';
import { TypeOrmWorkspaceMemberRepository } from './infrastructure/typeorm-workspace-member.repository.js';
import { MembersController } from './presentation/members.controller.js';

@Module({
  imports: [RolesModule, UsersModule],
  controllers: [MembersController],
  providers: [
    MembersService,
    { provide: WorkspaceMemberRepository, useClass: TypeOrmWorkspaceMemberRepository },
    TypeOrmMembershipReader,
  ],
  exports: [MembersService, TypeOrmMembershipReader],
})
export class MembersModule {}
