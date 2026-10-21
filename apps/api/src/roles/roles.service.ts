import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import type { Repository } from 'typeorm';
import { SYSTEM_ROLE_KEYS, type Permission } from '@taskflow/shared-types';
import type { Actor, WorkspaceAccess } from '../common/http/authenticated-request.js';
import { AuditLogger } from '../audit/audit-logger.js';
import { WorkspaceMemberEntity } from '../members/workspace-member.entity.js';
import type { CreateRoleDto, RoleDto, UpdateRoleDto } from './dto/role.dto.js';
import { WorkspaceRoleEntity } from './entities/workspace-role.entity.js';

/** Only the built-in Owner role may hold this; it controls deleting the workspace. */
const OWNER_ONLY_PERMISSION: Permission = 'workspace.manage';

@Injectable()
export class RolesService {
  constructor(
    @InjectRepository(WorkspaceRoleEntity) private readonly roles: Repository<WorkspaceRoleEntity>,
    @InjectRepository(WorkspaceMemberEntity) private readonly members: Repository<WorkspaceMemberEntity>,
    private readonly auditLogger: AuditLogger,
  ) {}

  async list(workspaceId: string): Promise<RoleDto[]> {
    const roles = await this.roles.find({ where: { workspaceId } });
    return roles.sort(compareRoles).map(toRoleDto);
  }

  async create(actor: Actor, access: WorkspaceAccess, dto: CreateRoleDto): Promise<RoleDto> {
    this.assertGrantable(access, dto.permissions);
    const role = await this.roles.save(
      this.roles.create({
        workspaceId: access.workspaceId,
        name: dto.name.trim(),
        systemKey: null,
        permissions: dto.permissions,
      }),
    );
    await this.audit(actor, 'role.create', role, { permissions: role.permissions });
    return toRoleDto(role);
  }

  async update(actor: Actor, access: WorkspaceAccess, roleId: string, dto: UpdateRoleDto): Promise<RoleDto> {
    const role = await this.findCustomRole(access.workspaceId, roleId);
    if (dto.permissions) {
      this.assertGrantable(access, dto.permissions);
      role.permissions = dto.permissions;
    }
    if (dto.name !== undefined) role.name = dto.name.trim();
    await this.roles.save(role);
    await this.audit(actor, 'role.update', role, { fields: Object.keys(dto), permissions: role.permissions });
    return toRoleDto(role);
  }

  async remove(actor: Actor, access: WorkspaceAccess, roleId: string): Promise<void> {
    const role = await this.findCustomRole(access.workspaceId, roleId);
    const inUse = await this.members.exists({ where: { workspaceId: access.workspaceId, roleId } });
    if (inUse) throw new ConflictException('Reassign members before deleting this role');
    await this.roles.delete({ id: role.id, workspaceId: access.workspaceId });
    await this.audit(actor, 'role.delete', role);
  }

  /** Stops privilege escalation: a caller can only grant permissions they already hold. */
  private assertGrantable(access: WorkspaceAccess, permissions: readonly Permission[]): void {
    if (permissions.includes(OWNER_ONLY_PERMISSION)) {
      throw new BadRequestException(`${OWNER_ONLY_PERMISSION} is reserved for the Owner role`);
    }
    const missing = permissions.filter((permission) => !access.permissions.has(permission));
    if (missing.length > 0) throw new ForbiddenException('You cannot grant permissions you do not have');
  }

  private async findCustomRole(workspaceId: string, roleId: string): Promise<WorkspaceRoleEntity> {
    const role = await this.roles.findOneBy({ id: roleId, workspaceId });
    if (!role) throw new NotFoundException();
    if (role.systemKey) throw new BadRequestException('Built-in roles cannot be changed');
    return role;
  }

  private audit(actor: Actor, action: string, role: WorkspaceRoleEntity, metadata?: Record<string, unknown>) {
    return this.auditLogger.record(actor, {
      action,
      targetType: 'role',
      targetId: role.id,
      workspaceId: role.workspaceId,
      metadata: { name: role.name, ...metadata },
    });
  }
}

export function toRoleDto(role: WorkspaceRoleEntity): RoleDto {
  return { id: role.id, name: role.name, systemKey: role.systemKey, permissions: role.permissions };
}

/** Built-in roles first, from most to least powerful, then custom roles by name. */
function compareRoles(a: WorkspaceRoleEntity, b: WorkspaceRoleEntity): number {
  const rank = (role: WorkspaceRoleEntity) =>
    role.systemKey ? SYSTEM_ROLE_KEYS.indexOf(role.systemKey) : SYSTEM_ROLE_KEYS.length;
  return rank(a) - rank(b) || a.name.localeCompare(b.name);
}
