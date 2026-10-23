import { Module } from '@nestjs/common';
import { RolesModule } from '../roles/roles.module.js';
import { UsersModule } from '../users/users.module.js';
import { MembersService } from './application/members.service.js';
import { WorkspaceMemberRepository } from './domain/workspace-member.repository.js';
import { TypeOrmMembershipReader } from './infrastructure/typeorm-membership.reader.js';
import { TypeOrmWorkspaceMemberRepository } from './infrastructure/typeorm-workspace-member.repository.js';
import { MembersResolver } from './presentation/graphql/members.resolver.js';

@Module({
  imports: [RolesModule, UsersModule],
  providers: [
    MembersService,
    MembersResolver,
    { provide: WorkspaceMemberRepository, useClass: TypeOrmWorkspaceMemberRepository },
    TypeOrmMembershipReader,
  ],
  exports: [MembersService, TypeOrmMembershipReader],
})
export class MembersModule {}
