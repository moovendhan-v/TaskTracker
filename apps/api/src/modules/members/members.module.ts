import { Module } from '@nestjs/common';
// Registers the module's query resource (filters, sorting, resourceSchema).
import './infrastructure/member.query-resource.js';
import { RolesModule } from '../roles/roles.module.js';
import { UsersModule } from '../users/users.module.js';
import { MemberQueryOptions } from './application/member-query-options.js';
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
    MemberQueryOptions,
  ],
  exports: [MembersService, TypeOrmMembershipReader],
})
export class MembersModule {}
