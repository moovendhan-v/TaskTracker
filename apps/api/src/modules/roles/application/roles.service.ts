import { Injectable } from '@nestjs/common';
import { SYSTEM_ROLE_POLICIES, type CreateRoleRequest, type RoleResponse, type UpdateRoleRequest } from '@taskflow/shared-types';
import { Audited } from '../../../core/audit/audited.decorator.js';
import { Cached } from '../../../core/cache/cached.decorator.js';
import { DomainError } from '../../../core/domain/domain-error.js';
import { found } from '../../../core/domain/found.js';
import { Announces } from '../../../core/events/announces.decorator.js';
import type { Actor, WorkspaceAccess } from '../../../core/http/types/authenticated-request.js';
import { workspaceFromAccess } from '../../../core/runtime/change-target.js';
import { effectiveAccessForRole } from '../domain/policy.js';
import { PolicyDocumentPolicy } from '../domain/policy-document.policy.js';
import { PolicyRepository } from '../domain/policy.repository.js';
import { RoleGrantPolicy } from '../domain/role-grant.policy.js';
import { buildSystemRoles, compareRoles } from '../domain/system-roles.js';
import type { WorkspaceRole } from '../domain/workspace-role.js';
import { WorkspaceRoleRepository } from '../domain/workspace-role.repository.js';
import { RoleMapper } from './role.mapper.js';

const change = { ...workspaceFromAccess, metadata: (role: RoleResponse) => ({ name: role.name, permissions: role.permissions }) };

@Injectable()
export class RolesService {
  constructor(
    private readonly roles: WorkspaceRoleRepository,
    private readonly policies: PolicyRepository,
  ) {}

  /** Every role with its policies and what it adds up to. Loads everything in three queries. */
  @Cached({ entities: ['role', 'policy'], shared: true })
  async list(workspaceId: string): Promise<RoleResponse[]> {
    const roles = await this.roles.listByWorkspace(workspaceId);
    return this.describe(workspaceId, roles.sort(compareRoles));
  }

  @Audited('role.create', change)
  @Announces('role.created', workspaceFromAccess)
  async create(_actor: Actor, access: WorkspaceAccess, request: CreateRoleRequest): Promise<RoleResponse> {
    RoleGrantPolicy.assertCanDefine(access.permissions, request.permissions);
    RoleGrantPolicy.assertKeepsSpaceRules(access, effectiveAccessForRole({ permissions: request.permissions, inlinePolicy: { statements: [] } }, [], new Map()));
    const role = await this.roles.create({
      workspaceId: access.workspaceId,
      name: request.name.trim(),
      systemKey: null,
      permissions: request.permissions,
    });
    return this.describeOne(access.workspaceId, role);
  }

  @Audited('role.update', change)
  @Announces('role.updated', workspaceFromAccess)
  async update(_actor: Actor, access: WorkspaceAccess, roleId: string, request: UpdateRoleRequest): Promise<RoleResponse> {
    const role = await this.findCustomRole(access.workspaceId, roleId);
    if (request.permissions) {
      RoleGrantPolicy.assertCanDefine(access.permissions, request.permissions);
      role.permissions = request.permissions;
      await this.assertKeepsSpaceRules(access, role);
    }
    if (request.name !== undefined) role.name = request.name.trim();
    return this.describeOne(access.workspaceId, await this.roles.save(role));
  }

  @Audited('role.delete', change)
  @Announces('role.deleted', workspaceFromAccess)
  async remove(_actor: Actor, access: WorkspaceAccess, roleId: string): Promise<RoleResponse> {
    const role = await this.findCustomRole(access.workspaceId, roleId);
    if (await this.roles.isAssigned(access.workspaceId, roleId)) {
      throw DomainError.conflict('Reassign members before deleting this role');
    }
    const described = await this.describeOne(access.workspaceId, role);
    await this.roles.delete(access.workspaceId, roleId);
    return described;
  }

  /** Creates the built-in roles for a new workspace, each with its managed policy. Call inside the workspace's transaction. */
  async seedSystemRoles(workspaceId: string): Promise<WorkspaceRole[]> {
    const roles = await this.roles.createMany(buildSystemRoles(workspaceId));
    for (const role of roles) {
      if (role.systemKey) await this.policies.attach(workspaceId, { roleId: role.id, managedKey: SYSTEM_ROLE_POLICIES[role.systemKey], policyId: null });
    }
    return roles;
  }

  /** The response for one role, with its policies and effective access. */
  async describeOne(workspaceId: string, role: WorkspaceRole): Promise<RoleResponse> {
    const [response] = await this.describe(workspaceId, [role]);
    return found(response, 'Role');
  }

  private async describe(workspaceId: string, roles: readonly WorkspaceRole[]): Promise<RoleResponse[]> {
    // Sequential on purpose: an operation's queries share one transaction connection.
    const attachments = await this.policies.listAttachments(workspaceId, roles.map((role) => role.id));
    const custom = new Map((await this.policies.list(workspaceId)).map((policy) => [policy.id, policy]));
    return roles.map((role) => {
      const own = attachments.filter((attachment) => attachment.roleId === role.id);
      const effective = effectiveAccessForRole(role, own, custom);
      return RoleMapper.toResponse(role, own, custom, {
        permissions: effective.permissions,
        readableFields: PolicyDocumentPolicy.readableFields(effective),
        spaceRules: effective.spaceRules,
      });
    });
  }

  /** The role after a permission change, with its policies, must stay out of the spaces the actor is kept out of. */
  private async assertKeepsSpaceRules(access: WorkspaceAccess, role: WorkspaceRole): Promise<void> {
    if (access.spaceRules.length === 0) return;
    const attachments = await this.policies.listAttachments(access.workspaceId, [role.id]);
    const custom = new Map((await this.policies.list(access.workspaceId)).map((policy) => [policy.id, policy]));
    RoleGrantPolicy.assertKeepsSpaceRules(access, effectiveAccessForRole(role, attachments, custom));
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
