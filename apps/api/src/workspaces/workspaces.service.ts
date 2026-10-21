import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { DataSource, type Repository } from 'typeorm';
import { PERMISSIONS, type Permission } from '@taskflow/shared-types';
import type { Actor, WorkspaceAccess } from '../common/http/authenticated-request.js';
import { AuditLogger } from '../audit/audit-logger.js';
import { WorkspaceMemberEntity } from '../members/workspace-member.entity.js';
import { WorkspaceRoleEntity } from '../roles/entities/workspace-role.entity.js';
import { buildSystemRoles } from '../roles/system-roles.js';
import type { CreateWorkspaceDto, UpdateWorkspaceDto, WorkspaceDto } from './dto/workspace.dto.js';
import { WorkspaceEntity } from './entities/workspace.entity.js';

const DEFAULT_COLOR = '#6366f1';

@Injectable()
export class WorkspacesService {
  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    @InjectRepository(WorkspaceEntity) private readonly workspaces: Repository<WorkspaceEntity>,
    @InjectRepository(WorkspaceMemberEntity) private readonly members: Repository<WorkspaceMemberEntity>,
    private readonly auditLogger: AuditLogger,
  ) {}

  async listForUser(userId: string): Promise<WorkspaceDto[]> {
    const memberships = await this.members.find({
      where: { userId },
      relations: { role: true },
      order: { createdAt: 'ASC' },
    });
    if (memberships.length === 0) return [];

    const workspaces = await this.workspaces.findBy(memberships.map((m) => ({ id: m.workspaceId })));
    const byId = new Map(workspaces.map((w) => [w.id, w]));
    return memberships.flatMap((membership) => {
      const workspace = byId.get(membership.workspaceId);
      return workspace && membership.role
        ? [toWorkspaceDto(workspace, membership.role.name, membership.role.permissions)]
        : [];
    });
  }

  /** Creates the workspace, its built-in roles and the owner membership in one transaction. */
  async create(actor: Actor, dto: CreateWorkspaceDto): Promise<WorkspaceDto> {
    const { workspace, ownerRole } = await this.dataSource.transaction(async (manager) => {
      const workspace = await manager.save(
        manager.create(WorkspaceEntity, { name: dto.name.trim(), color: dto.color ?? DEFAULT_COLOR, ownerId: actor.userId }),
      );
      const roles = await manager.save(
        buildSystemRoles(workspace.id).map((role) => manager.create(WorkspaceRoleEntity, role)),
      );
      const ownerRole = roles.find((role) => role.systemKey === 'owner');
      if (!ownerRole) throw new Error('Owner role was not seeded');
      await manager.save(
        manager.create(WorkspaceMemberEntity, { workspaceId: workspace.id, userId: actor.userId, roleId: ownerRole.id }),
      );
      return { workspace, ownerRole };
    });

    await this.auditLogger.record(actor, {
      action: 'workspace.create',
      targetType: 'workspace',
      targetId: workspace.id,
      workspaceId: workspace.id,
    });
    return toWorkspaceDto(workspace, ownerRole.name, ownerRole.permissions);
  }

  async get(access: WorkspaceAccess): Promise<WorkspaceDto> {
    const workspace = await this.findOrFail(access.workspaceId);
    return toWorkspaceDto(workspace, await this.roleName(access), [...access.permissions]);
  }

  async update(actor: Actor, access: WorkspaceAccess, dto: UpdateWorkspaceDto): Promise<WorkspaceDto> {
    const workspace = await this.findOrFail(access.workspaceId);
    if (dto.name !== undefined) workspace.name = dto.name.trim();
    if (dto.color !== undefined) workspace.color = dto.color;
    await this.workspaces.save(workspace);

    await this.auditLogger.record(actor, {
      action: 'workspace.update',
      targetType: 'workspace',
      targetId: workspace.id,
      workspaceId: workspace.id,
      metadata: { fields: Object.keys(dto) },
    });
    return toWorkspaceDto(workspace, await this.roleName(access), [...access.permissions]);
  }

  async remove(actor: Actor, access: WorkspaceAccess): Promise<void> {
    await this.findOrFail(access.workspaceId);
    await this.auditLogger.record(actor, {
      action: 'workspace.delete',
      targetType: 'workspace',
      targetId: access.workspaceId,
      workspaceId: access.workspaceId,
    });
    // Child rows are removed by ON DELETE CASCADE foreign keys.
    await this.workspaces.delete({ id: access.workspaceId });
  }

  private async findOrFail(id: string): Promise<WorkspaceEntity> {
    const workspace = await this.workspaces.findOneBy({ id });
    if (!workspace) throw new NotFoundException();
    return workspace;
  }

  private async roleName(access: WorkspaceAccess): Promise<string> {
    if (access.viaPlatformRole || !access.roleId) return 'Platform admin';
    const role = await this.dataSource.getRepository(WorkspaceRoleEntity).findOneBy({ id: access.roleId });
    return role?.name ?? 'Member';
  }
}

function toWorkspaceDto(workspace: WorkspaceEntity, roleName: string, permissions: Permission[]): WorkspaceDto {
  return {
    id: workspace.id,
    name: workspace.name,
    color: workspace.color,
    roleName,
    permissions: PERMISSIONS.filter((p) => permissions.includes(p)),
    createdAt: workspace.createdAt.toISOString(),
  };
}
