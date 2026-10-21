import { Injectable } from '@nestjs/common';
import type { CreateRoleRequest, RoleResponse, UpdateRoleRequest } from '@taskflow/shared-types';
import { AuditLogger } from '../../../core/audit/audit-logger.port.js';
import { DomainError } from '../../../core/domain/domain-error.js';
import type { Actor, WorkspaceAccess } from '../../../core/http/types/authenticated-request.js';
import { RoleGrantPolicy } from '../domain/role-grant.policy.js';
import { buildSystemRoles, compareRoles } from '../domain/system-roles.js';
import type { WorkspaceRole } from '../domain/workspace-role.js';
import { WorkspaceRoleRepository } from '../domain/workspace-role.repository.js';
import { RoleMapper } from './role.mapper.js';

@Injectable()
export class RolesService {
  constructor(
    private readonly roles: WorkspaceRoleRepository,
    private readonly auditLogger: AuditLogger,
  ) {}

  async list(workspaceId: string): Promise<RoleResponse[]> {
    const roles = await this.roles.listByWorkspace(workspaceId);
    return roles.sort(compareRoles).map(RoleMapper.toResponse);
  }

  async create(actor: Actor, access: WorkspaceAccess, request: CreateRoleRequest): Promise<RoleResponse> {
    RoleGrantPolicy.assertCanDefine(access.permissions, request.permissions);
    const role = await this.roles.create({
      workspaceId: access.workspaceId,
      name: request.name.trim(),
      systemKey: null,
      permissions: request.permissions,
    });
    await this.audit(actor, 'role.create', role);
    return RoleMapper.toResponse(role);
  }

  async update(actor: Actor, access: WorkspaceAccess, roleId: string, request: UpdateRoleRequest): Promise<RoleResponse> {
    const role = await this.findCustomRole(access.workspaceId, roleId);
    if (request.permissions) {
      RoleGrantPolicy.assertCanDefine(access.permissions, request.permissions);
      role.permissions = request.permissions;
    }
    if (request.name !== undefined) role.name = request.name.trim();
    const saved = await this.roles.save(role);
    await this.audit(actor, 'role.update', saved, { fields: Object.keys(request) });
    return RoleMapper.toResponse(saved);
  }

  async remove(actor: Actor, access: WorkspaceAccess, roleId: string): Promise<void> {
    const role = await this.findCustomRole(access.workspaceId, roleId);
    if (await this.roles.isAssigned(access.workspaceId, roleId)) {
      throw DomainError.conflict('Reassign members before deleting this role');
    }
    await this.roles.delete(access.workspaceId, roleId);
    await this.audit(actor, 'role.delete', role);
  }

  /** Creates the built-in roles for a new workspace. Call inside the workspace's transaction. */
  seedSystemRoles(workspaceId: string): Promise<WorkspaceRole[]> {
    return this.roles.createMany(buildSystemRoles(workspaceId));
  }

  async getInWorkspace(workspaceId: string, roleId: string): Promise<WorkspaceRole> {
    const role = await this.roles.findInWorkspace(workspaceId, roleId);
    if (!role) throw DomainError.notFound('Role');
    return role;
  }

  private async findCustomRole(workspaceId: string, roleId: string): Promise<WorkspaceRole> {
    const role = await this.getInWorkspace(workspaceId, roleId);
    if (role.systemKey) throw DomainError.invalid('Built-in roles cannot be changed');
    return role;
  }

  private audit(actor: Actor, action: string, role: WorkspaceRole, metadata?: Record<string, unknown>) {
    return this.auditLogger.record(actor, {
      action,
      targetType: 'role',
      targetId: role.id,
      workspaceId: role.workspaceId,
      metadata: { name: role.name, permissions: role.permissions, ...metadata },
    });
  }
}
