import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource, type EntityManager } from 'typeorm';
import type { Actor, WorkspaceAccess } from '../common/http/authenticated-request.js';
import { AuditLogger } from '../audit/audit-logger.js';
import { WorkspaceRoleEntity } from '../roles/entities/workspace-role.entity.js';
import { UserEntity } from '../users/user.entity.js';
import type { AddMemberDto, AddMemberResultDto, MemberDto, UpdateMemberRoleDto } from './dto/member.dto.js';
import { WorkspaceMemberEntity } from './workspace-member.entity.js';

const ADD_MEMBER_MESSAGE = 'If that person has a TaskFlow account, they now have access to this workspace.';

@Injectable()
export class MembersService {
  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    private readonly auditLogger: AuditLogger,
  ) {}

  async list(workspaceId: string): Promise<MemberDto[]> {
    const members = await this.dataSource.getRepository(WorkspaceMemberEntity).find({
      where: { workspaceId },
      relations: { role: true, user: true },
      order: { createdAt: 'ASC' },
    });
    return members.map(toMemberDto);
  }

  /** Answers the same way whether or not the email has an account, so it can't be used to find users. */
  async add(actor: Actor, access: WorkspaceAccess, dto: AddMemberDto): Promise<AddMemberResultDto> {
    await this.dataSource.transaction(async (manager) => {
      const role = await this.findRole(manager, access.workspaceId, dto.roleId);
      this.assertCanAssign(access, role);

      const user = await manager.findOneBy(UserEntity, { email: dto.email.trim().toLowerCase() });
      if (!user) return;

      const result = await manager
        .createQueryBuilder()
        .insert()
        .into(WorkspaceMemberEntity)
        .values({ workspaceId: access.workspaceId, userId: user.id, roleId: role.id })
        .orIgnore()
        .execute();
      if (result.identifiers.length === 0) return;

      await this.auditLogger.record(actor, {
        action: 'member.add',
        targetType: 'user',
        targetId: user.id,
        workspaceId: access.workspaceId,
        metadata: { roleId: role.id, roleName: role.name },
      });
    });
    return { message: ADD_MEMBER_MESSAGE };
  }

  async updateRole(actor: Actor, access: WorkspaceAccess, userId: string, dto: UpdateMemberRoleDto): Promise<MemberDto> {
    if (userId === actor.userId) throw new BadRequestException('You cannot change your own role');

    await this.dataSource.transaction(async (manager) => {
      const member = await this.findMember(manager, access.workspaceId, userId);
      this.assertCanAssign(access, member.role);
      const role = await this.findRole(manager, access.workspaceId, dto.roleId);
      this.assertCanAssign(access, role);

      if (member.role?.systemKey === 'owner' && role.systemKey !== 'owner') {
        await this.assertAnotherOwner(manager, access.workspaceId, member.roleId);
      }
      member.roleId = role.id;
      await manager.update(WorkspaceMemberEntity, { id: member.id, workspaceId: access.workspaceId }, { roleId: role.id });
      await this.auditLogger.record(actor, {
        action: 'member.role_change',
        targetType: 'user',
        targetId: userId,
        workspaceId: access.workspaceId,
        metadata: { from: member.role?.name, to: role.name },
      });
    });

    const updated = await this.dataSource.getRepository(WorkspaceMemberEntity).findOneOrFail({
      where: { workspaceId: access.workspaceId, userId },
      relations: { role: true, user: true },
    });
    return toMemberDto(updated);
  }

  async remove(actor: Actor, access: WorkspaceAccess, userId: string): Promise<void> {
    await this.dataSource.transaction(async (manager) => {
      const member = await this.findMember(manager, access.workspaceId, userId);
      if (userId !== actor.userId) this.assertCanAssign(access, member.role);
      if (member.role?.systemKey === 'owner') {
        await this.assertAnotherOwner(manager, access.workspaceId, member.roleId);
      }
      await manager.delete(WorkspaceMemberEntity, { id: member.id, workspaceId: access.workspaceId });
      await this.auditLogger.record(actor, {
        action: userId === actor.userId ? 'member.leave' : 'member.remove',
        targetType: 'user',
        targetId: userId,
        workspaceId: access.workspaceId,
      });
    });
  }

  /** A caller can only hand out, or take away, a role whose permissions they already hold. */
  private assertCanAssign(access: WorkspaceAccess, role: WorkspaceRoleEntity | undefined): void {
    const permissions = role?.permissions ?? [];
    if (permissions.some((permission) => !access.permissions.has(permission))) {
      throw new ForbiddenException('That role has permissions you do not have');
    }
  }

  private async assertAnotherOwner(manager: EntityManager, workspaceId: string, ownerRoleId: string): Promise<void> {
    // Lock owner rows so two concurrent demotions can't both pass.
    const owners = await manager
      .getRepository(WorkspaceMemberEntity)
      .createQueryBuilder('member')
      .setLock('pessimistic_write')
      .where('member.workspace_id = :workspaceId AND member.role_id = :ownerRoleId', { workspaceId, ownerRoleId })
      .getMany();
    if (owners.length <= 1) throw new BadRequestException('A workspace needs at least one owner');
  }

  private async findRole(manager: EntityManager, workspaceId: string, roleId: string): Promise<WorkspaceRoleEntity> {
    const role = await manager.findOneBy(WorkspaceRoleEntity, { id: roleId, workspaceId });
    if (!role) throw new NotFoundException('Role not found');
    return role;
  }

  private async findMember(manager: EntityManager, workspaceId: string, userId: string): Promise<WorkspaceMemberEntity> {
    const member = await manager.findOne(WorkspaceMemberEntity, {
      where: { workspaceId, userId },
      relations: { role: true },
    });
    if (!member) throw new NotFoundException('Member not found');
    return member;
  }
}

function toMemberDto(member: WorkspaceMemberEntity): MemberDto {
  return {
    userId: member.userId,
    name: member.user?.name ?? '',
    email: member.user?.email ?? '',
    roleId: member.roleId,
    roleName: member.role?.name ?? '',
    joinedAt: member.createdAt.toISOString(),
  };
}
