import { Injectable } from '@nestjs/common';
import type { CreateRoleRequest, RoleResponse, UpdateRoleRequest } from '@taskflow/shared-types';
import { Audited } from '../../../core/audit/audited.decorator.js';
import { Cached } from '../../../core/cache/cached.decorator.js';
import { DomainError } from '../../../core/domain/domain-error.js';
import { found } from '../../../core/domain/found.js';
import { Announces } from '../../../core/events/announces.decorator.js';
import type { Actor, WorkspaceAccess } from '../../../core/http/types/authenticated-request.js';
import { workspaceFromAccess } from '../../../core/runtime/change-target.js';
import { RoleGrantPolicy } from '../domain/role-grant.policy.js';
import { buildSystemRoles, compareRoles } from '../domain/system-roles.js';
import type { WorkspaceRole } from '../domain/workspace-role.js';
import { WorkspaceRoleRepository } from '../domain/workspace-role.repository.js';
import { RoleMapper } from './role.mapper.js';

const change = { ...workspaceFromAccess, metadata: (role: RoleResponse) => ({ name: role.name, permissions: role.permissions }) };

@Injectable()
export class RolesService {
  constructor(private readonly roles: WorkspaceRoleRepository) {}

  @Cached({ entities: ['role', 'policy'], shared: true })
  async list(workspaceId: string): Promise<RoleResponse[]> {
    const roles = await this.roles.listByWorkspace(workspaceId);
    return roles.sort(compareRoles).map(RoleMapper.toResponse);
  }

  @Audited('role.create', change)
  @Announces('role.created', workspaceFromAccess)
  async create(_actor: Actor, access: WorkspaceAccess, request: CreateRoleRequest): Promise<RoleResponse> {
    RoleGrantPolicy.assertCanDefine(access.permissions, request.permissions);
    const role = await this.roles.create({
      workspaceId: access.workspaceId,
      name: request.name.trim(),
      systemKey: null,
      permissions: request.permissions,
    });
    return RoleMapper.toResponse(role);
  }

  @Audited('role.update', change)
  @Announces('role.updated', workspaceFromAccess)
  async update(_actor: Actor, access: WorkspaceAccess, roleId: string, request: UpdateRoleRequest): Promise<RoleResponse> {
    const role = await this.findCustomRole(access.workspaceId, roleId);
    if (request.permissions) {
      RoleGrantPolicy.assertCanDefine(access.permissions, request.permissions);
      role.permissions = request.permissions;
    }
    if (request.name !== undefined) role.name = request.name.trim();
    return RoleMapper.toResponse(await this.roles.save(role));
  }

  @Audited('role.delete', change)
  @Announces('role.deleted', workspaceFromAccess)
  async remove(_actor: Actor, access: WorkspaceAccess, roleId: string): Promise<RoleResponse> {
    const role = await this.findCustomRole(access.workspaceId, roleId);
    if (await this.roles.isAssigned(access.workspaceId, roleId)) {
      throw DomainError.conflict('Reassign members before deleting this role');
    }
    await this.roles.delete(access.workspaceId, roleId);
    return RoleMapper.toResponse(role);
  }

  /** Creates the built-in roles for a new workspace. Call inside the workspace's transaction. */
  seedSystemRoles(workspaceId: string): Promise<WorkspaceRole[]> {
    return this.roles.createMany(buildSystemRoles(workspaceId));
  }

  async getInWorkspace(workspaceId: string, roleId: string): Promise<WorkspaceRole> {
    return found(await this.roles.findInWorkspace(workspaceId, roleId), 'Role');
  }

  private async findCustomRole(workspaceId: string, roleId: string): Promise<WorkspaceRole> {
    const role = await this.getInWorkspace(workspaceId, roleId);
    if (role.systemKey) throw DomainError.invalid('Built-in roles cannot be changed');
    return role;
  }
}
