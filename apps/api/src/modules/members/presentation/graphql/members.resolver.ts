import { Args, ID, Mutation, Query, Resolver } from '@nestjs/graphql';
import { CurrentAccess } from '../../../../core/access/current-access.decorator.js';
import { RequirePermissions } from '../../../../core/access/require-permissions.decorator.js';
import { UuidArg, WorkspaceIdArg } from '../../../../core/graphql/args.js';
import { resourceQueryComplexity } from '../../../../core/graphql/resource-query.types.js';
import type { NormalizedQuery } from '../../../../core/query/normalize-query.js';
import { ResourceQueryArg, ValidatedQuery } from '../../../../core/query/resource-query.decorator.js';
import { CurrentActor } from '../../../../core/http/decorators/current-actor.decorator.js';
import type { Actor, WorkspaceAccess } from '../../../../core/http/types/authenticated-request.js';
import { MembersService } from '../../application/members.service.js';
import { AddMemberInput, AddMemberResultGql, MemberGql, MemberPageGql } from './member.types.js';

@Resolver(() => MemberGql)
export class MembersResolver {
  constructor(private readonly membersService: MembersService) {}

  @Query(() => [MemberGql])
  @RequirePermissions()
  members(@WorkspaceIdArg() _workspaceId: string, @CurrentAccess() access: WorkspaceAccess): Promise<MemberGql[]> {
    return this.membersService.list(access.workspaceId);
  }

  @Query(() => MemberPageGql, { complexity: resourceQueryComplexity, description: 'Members matching filters, sort and paging; see resourceSchema(resource: "members")' })
  @RequirePermissions()
  searchMembers(
    @WorkspaceIdArg() _workspaceId: string,
    @ResourceQueryArg() _query: unknown,
    @ValidatedQuery('members') query: NormalizedQuery,
    @CurrentAccess() access: WorkspaceAccess,
  ): Promise<MemberPageGql> {
    return this.membersService.search(access.workspaceId, query);
  }

  @Mutation(() => AddMemberResultGql)
  @RequirePermissions('members.manage')
  addMember(
    @WorkspaceIdArg() _workspaceId: string,
    @Args('input') input: AddMemberInput,
    @CurrentActor() actor: Actor,
    @CurrentAccess() access: WorkspaceAccess,
  ): Promise<AddMemberResultGql> {
    return this.membersService.add(actor, access, input);
  }

  @Mutation(() => MemberGql)
  @RequirePermissions('members.manage')
  updateMemberRole(
    @WorkspaceIdArg() _workspaceId: string,
    @Args('userId', { type: () => ID }) userId: string,
    @UuidArg('roleId') roleId: string,
    @CurrentActor() actor: Actor,
    @CurrentAccess() access: WorkspaceAccess,
  ): Promise<MemberGql> {
    return this.membersService.updateRole(actor, access, userId, { roleId });
  }

  @Mutation(() => Boolean)
  @RequirePermissions('members.manage')
  async removeMember(
    @WorkspaceIdArg() _workspaceId: string,
    @Args('userId', { type: () => ID }) userId: string,
    @CurrentActor() actor: Actor,
    @CurrentAccess() access: WorkspaceAccess,
  ): Promise<boolean> {
    await this.membersService.remove(actor, access, userId);
    return true;
  }

  @Mutation(() => Boolean, { description: 'Leave a workspace. The last owner cannot leave.' })
  @RequirePermissions()
  async leaveWorkspace(@WorkspaceIdArg() _workspaceId: string, @CurrentActor() actor: Actor, @CurrentAccess() access: WorkspaceAccess): Promise<boolean> {
    await this.membersService.remove(actor, access, actor.userId);
    return true;
  }
}
