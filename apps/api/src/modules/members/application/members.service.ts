import { Injectable } from '@nestjs/common';
import type { AddMemberRequest, MemberResponse, Permission, UpdateMemberRoleRequest } from '@taskflow/shared-types';
import { AuditLogger } from '../../../core/audit/audit-logger.port.js';
import { UnitOfWork } from '../../../core/database/unit-of-work.port.js';
import { DomainError } from '../../../core/domain/domain-error.js';
import { domainEvent } from '../../../core/events/domain-event.js';
import { EventBus } from '../../../core/events/event-bus.port.js';
import type { Actor, WorkspaceAccess } from '../../../core/http/types/authenticated-request.js';
import { RolesService } from '../../roles/application/roles.service.js';
import { RoleGrantPolicy } from '../../roles/domain/role-grant.policy.js';
import { UsersService } from '../../users/application/users.service.js';
import { OwnerGuardPolicy } from '../domain/owner-guard.policy.js';
import type { MembershipWithRole } from '../domain/workspace-member.js';
import { WorkspaceMemberRepository } from '../domain/workspace-member.repository.js';
import { MemberMapper } from './member.mapper.js';

export const ADD_MEMBER_MESSAGE =
  'If that person has a TaskFlow account with a confirmed email, they now have access to this workspace.';

@Injectable()
export class MembersService {
  constructor(
    private readonly members: WorkspaceMemberRepository,
    private readonly rolesService: RolesService,
    private readonly usersService: UsersService,
    private readonly unitOfWork: UnitOfWork,
    private readonly auditLogger: AuditLogger,
    private readonly eventBus: EventBus,
  ) {}

  async list(workspaceId: string): Promise<MemberResponse[]> {
    const members = await this.members.listDetails(workspaceId);
    return members.map(MemberMapper.toResponse);
  }

  /**
   * Answers the same way whether or not the email has an account, so it can't be used to find users.
   * Only confirmed emails count: otherwise anyone could sign up with a colleague's address first.
   */
  async add(actor: Actor, access: WorkspaceAccess, request: AddMemberRequest): Promise<{ message: string }> {
    await this.unitOfWork.run(async () => {
      const role = await this.rolesService.getInWorkspace(access.workspaceId, request.roleId);
      RoleGrantPolicy.assertCanHandOut(access.permissions, role.permissions);

      const user = await this.usersService.findVerifiedByEmail(request.email);
      if (!user) return;

      const added = await this.members.addIfAbsent({ workspaceId: access.workspaceId, userId: user.id, roleId: role.id });
      if (!added) return;
      await this.auditLogger.record(actor, {
        action: 'member.add',
        targetType: 'user',
        targetId: user.id,
        workspaceId: access.workspaceId,
        metadata: { roleId: role.id, roleName: role.name },
      });
      await this.announce('created', actor, access.workspaceId, user.id, role.name);
    });
    return { message: ADD_MEMBER_MESSAGE };
  }

  async updateRole(
    actor: Actor,
    access: WorkspaceAccess,
    userId: string,
    request: UpdateMemberRoleRequest,
  ): Promise<MemberResponse> {
    if (userId === actor.userId) throw DomainError.invalid('You cannot change your own role');

    await this.unitOfWork.run(async () => {
      const membership = await this.getMembership(access.workspaceId, userId);
      RoleGrantPolicy.assertCanHandOut(access.permissions, membership.permissions);
      const role = await this.rolesService.getInWorkspace(access.workspaceId, request.roleId);
      RoleGrantPolicy.assertCanHandOut(access.permissions, role.permissions);

      if (membership.roleSystemKey === 'owner' && role.systemKey !== 'owner') {
        await this.assertAnotherOwner(membership);
      }
      await this.members.updateRole(access.workspaceId, userId, role.id);
      await this.auditLogger.record(actor, {
        action: 'member.role_change',
        targetType: 'user',
        targetId: userId,
        workspaceId: access.workspaceId,
        metadata: { from: membership.roleName, to: role.name },
      });
      await this.announce('updated', actor, access.workspaceId, userId, role.name);
    });

    const details = await this.members.findDetails(access.workspaceId, userId);
    if (!details) throw DomainError.notFound('Member');
    return MemberMapper.toResponse(details);
  }

  async remove(actor: Actor, access: WorkspaceAccess, userId: string): Promise<void> {
    const leaving = userId === actor.userId;
    await this.unitOfWork.run(async () => {
      const membership = await this.getMembership(access.workspaceId, userId);
      if (!leaving) RoleGrantPolicy.assertCanHandOut(access.permissions, membership.permissions);
      if (membership.roleSystemKey === 'owner') await this.assertAnotherOwner(membership);

      await this.members.remove(access.workspaceId, userId);
      await this.auditLogger.record(actor, {
        action: leaving ? 'member.leave' : 'member.remove',
        targetType: 'user',
        targetId: userId,
        workspaceId: access.workspaceId,
      });
      await this.announce('deleted', actor, access.workspaceId, userId);
    });
  }

  private announce(change: 'created' | 'updated' | 'deleted', actor: Actor, workspaceId: string, userId: string, roleName?: string): Promise<void> {
    return this.eventBus.publish(
      domainEvent('member', change, { workspaceId, entityId: userId, actorId: actor.userId, facts: { userId, roleName } }),
    );
  }

  /** Adds the creator as owner of a new workspace. Call inside the workspace's transaction. */
  async addOwner(workspaceId: string, userId: string, ownerRoleId: string): Promise<void> {
    await this.members.addIfAbsent({ workspaceId, userId, roleId: ownerRoleId });
  }

  listMembershipsForUser(userId: string): Promise<MembershipWithRole[]> {
    return this.members.listMembershipsForUser(userId);
  }

  isMember(workspaceId: string, userId: string): Promise<boolean> {
    return this.members.isMember(workspaceId, userId);
  }

  listUserIdsWithPermission(workspaceId: string, permission: Permission): Promise<string[]> {
    return this.members.listUserIdsWithPermission(workspaceId, permission);
  }

  private async getMembership(workspaceId: string, userId: string): Promise<MembershipWithRole> {
    const membership = await this.members.findMembership(workspaceId, userId);
    if (!membership) throw DomainError.notFound('Member');
    return membership;
  }

  private async assertAnotherOwner(owner: MembershipWithRole): Promise<void> {
    const owners = await this.members.countWithRoleForUpdate(owner.workspaceId, owner.roleId);
    OwnerGuardPolicy.assertAnotherOwnerRemains(owners);
  }
}
