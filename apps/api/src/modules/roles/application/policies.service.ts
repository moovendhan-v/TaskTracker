import { Injectable } from '@nestjs/common';
import { MANAGED_POLICIES, type PolicyDocument, type PolicyResponse, type RoleResponse, type SavePolicyRequest } from '@taskflow/shared-types';
import { Audited } from '../../../core/audit/audited.decorator.js';
import { Cached } from '../../../core/cache/cached.decorator.js';
import { DomainError } from '../../../core/domain/domain-error.js';
import { found } from '../../../core/domain/found.js';
import { Announces } from '../../../core/events/announces.decorator.js';
import type { Actor, WorkspaceAccess } from '../../../core/http/types/authenticated-request.js';
import { workspaceFromAccess } from '../../../core/runtime/change-target.js';
import { findManagedPolicy, PolicyRef, type CustomPolicy, type PolicyAttachment } from '../domain/policy.js';
import { RoleGrantPolicy } from '../domain/role-grant.policy.js';
import { PolicyDocumentPolicy } from '../domain/policy-document.policy.js';
import { PolicyRepository } from '../domain/policy.repository.js';
import type { WorkspaceRole } from '../domain/workspace-role.js';
import { WorkspaceRoleRepository } from '../domain/workspace-role.repository.js';
import { RoleAccessService, type RoleAccess } from './role-access.service.js';
import { RolesService } from './roles.service.js';

const policyChange = { ...workspaceFromAccess, targetType: 'policy', metadata: (policy: PolicyResponse) => ({ name: policy.name, document: policy.document }) };
const roleChange = (detail: (role: RoleResponse) => Record<string, unknown>) => ({ ...workspaceFromAccess, targetType: 'role', metadata: detail });

/**
 * Custom policies and which policies each role uses. Every change is checked
 * against the actor's own access, so nobody can give a role (their own
 * included) more than they have, and the owner role can't be changed at all.
 */
@Injectable()
export class PoliciesService {
  constructor(
    private readonly policies: PolicyRepository,
    private readonly roles: WorkspaceRoleRepository,
    private readonly rolesService: RolesService,
    private readonly roleAccess: RoleAccessService,
  ) {}

  /** Managed policies first, then the workspace's own, each with how many roles use it. */
  @Cached({ entities: ['policy', 'role'], shared: true })
  async list(workspaceId: string): Promise<PolicyResponse[]> {
    const attachments = await this.policies.listAttachments(workspaceId);
    const custom = await this.policies.list(workspaceId);
    const countOf = (ref: string) => attachments.filter((attachment) => PolicyRef.of(attachment) === ref).length;
    return [
      ...MANAGED_POLICIES.map((policy) => ({
        id: PolicyRef.managed(policy.key),
        name: policy.name,
        description: policy.description,
        managed: true,
        document: policy.document,
        attachedRoleCount: countOf(PolicyRef.managed(policy.key)),
      })),
      ...custom.map((policy) => toResponse(policy, countOf(policy.id))),
    ];
  }

  @Audited('policy.create', policyChange)
  @Announces('policy.created', workspaceFromAccess)
  async create(actor: Actor, access: WorkspaceAccess, request: SavePolicyRequest): Promise<PolicyResponse> {
    const document = PolicyDocumentPolicy.normalize(request.document);
    PolicyDocumentPolicy.assertCanGrant(access, document);
    const policy = await this.policies.create({
      workspaceId: access.workspaceId,
      name: request.name.trim(),
      description: request.description?.trim() ?? '',
      document,
      createdById: actor.userId,
    });
    return toResponse(policy, 0);
  }

  @Audited('policy.update', policyChange)
  @Announces('policy.updated', workspaceFromAccess)
  async update(_actor: Actor, access: WorkspaceAccess, policyId: string, request: SavePolicyRequest): Promise<PolicyResponse> {
    const policy = await this.getCustom(access.workspaceId, policyId);
    const next: CustomPolicy = { ...policy, name: request.name.trim(), description: request.description?.trim() ?? policy.description, document: PolicyDocumentPolicy.normalize(request.document) };
    PolicyDocumentPolicy.assertCanGrant(access, next.document);
    // Editing a policy changes every role that uses it; each must stay within the actor's access.
    const attachments = await this.policies.listAttachments(access.workspaceId);
    const users = attachments.filter((attachment) => attachment.policyId === policyId);
    for (const { roleId } of users) {
      const role = await this.getChangeableRole(access.workspaceId, roleId);
      const roleAttachments = attachments.filter((attachment) => attachment.roleId === roleId);
      assertWithin(access, await this.roleAccess.preview(access.workspaceId, role, roleAttachments, new Map([[policyId, next]])));
    }
    return toResponse(await this.policies.save(next), users.length);
  }

  @Audited('policy.delete', policyChange)
  @Announces('policy.deleted', workspaceFromAccess)
  async remove(_actor: Actor, access: WorkspaceAccess, policyId: string): Promise<PolicyResponse> {
    const policy = await this.getCustom(access.workspaceId, policyId);
    const attachments = await this.policies.listAttachments(access.workspaceId);
    // Removing a policy can lift a deny it held, so every role using it must stay within the actor's access too.
    for (const roleId of new Set(attachments.filter((attachment) => attachment.policyId === policyId).map((attachment) => attachment.roleId))) {
      const role = await this.getChangeableRole(access.workspaceId, roleId);
      const remaining = attachments.filter((attachment) => attachment.roleId === roleId && attachment.policyId !== policyId);
      assertWithin(access, await this.roleAccess.preview(access.workspaceId, role, remaining));
    }
    await this.policies.delete(access.workspaceId, policyId);
    return toResponse(policy, 0);
  }

  @Audited('role.policy_attach', roleChange((role) => ({ name: role.name, policies: role.policies.map((policy) => policy.ref) })))
  @Announces('role.updated', workspaceFromAccess)
  async attach(_actor: Actor, access: WorkspaceAccess, roleId: string, ref: string): Promise<RoleResponse> {
    const role = await this.getChangeableRole(access.workspaceId, roleId);
    const attachment = await this.resolveRef(access.workspaceId, roleId, ref);
    const current = await this.policies.listAttachments(access.workspaceId, [roleId]);
    assertWithin(access, await this.roleAccess.preview(access.workspaceId, role, [...current, attachment]));
    if (!(await this.policies.attach(access.workspaceId, attachment))) throw DomainError.conflict('The role already has that policy');
    return this.rolesService.describeOne(access.workspaceId, role);
  }

  @Audited('role.policy_detach', roleChange((role) => ({ name: role.name, policies: role.policies.map((policy) => policy.ref) })))
  @Announces('role.updated', workspaceFromAccess)
  async detach(_actor: Actor, access: WorkspaceAccess, roleId: string, ref: string): Promise<RoleResponse> {
    const role = await this.getChangeableRole(access.workspaceId, roleId);
    const attachment = await this.resolveRef(access.workspaceId, roleId, ref);
    const current = await this.policies.listAttachments(access.workspaceId, [roleId]);
    const remaining = current.filter((item) => PolicyRef.of(item) !== PolicyRef.of(attachment));
    assertWithin(access, await this.roleAccess.preview(access.workspaceId, role, remaining));
    if (!(await this.policies.detach(access.workspaceId, attachment))) throw DomainError.notFound('Policy attachment');
    return this.rolesService.describeOne(access.workspaceId, role);
  }

  @Audited('role.inline_policy', roleChange((role) => ({ name: role.name, inlinePolicy: role.inlinePolicy })))
  @Announces('role.updated', workspaceFromAccess)
  async setInline(_actor: Actor, access: WorkspaceAccess, roleId: string, document: PolicyDocument): Promise<RoleResponse> {
    const role = await this.getChangeableRole(access.workspaceId, roleId);
    const next: WorkspaceRole = { ...role, inlinePolicy: PolicyDocumentPolicy.normalize(document) };
    PolicyDocumentPolicy.assertCanGrant(access, next.inlinePolicy);
    const attachments = await this.policies.listAttachments(access.workspaceId, [roleId]);
    assertWithin(access, await this.roleAccess.preview(access.workspaceId, next, attachments));
    return this.rolesService.describeOne(access.workspaceId, await this.roles.save(next));
  }

  private async getCustom(workspaceId: string, policyId: string): Promise<CustomPolicy> {
    return found(await this.policies.findInWorkspace(workspaceId, policyId), 'Policy');
  }

  /** The owner role always has full access, so nobody can lock the workspace's owners out. */
  private async getChangeableRole(workspaceId: string, roleId: string): Promise<WorkspaceRole> {
    const role = found(await this.roles.findInWorkspace(workspaceId, roleId), 'Role');
    if (role.systemKey === 'owner') throw DomainError.invalid("The Owner role's policies can't be changed");
    return role;
  }

  private async resolveRef(workspaceId: string, roleId: string, ref: string): Promise<PolicyAttachment> {
    const parsed = PolicyRef.parse(ref);
    if ('managedKey' in parsed) {
      if (!findManagedPolicy(parsed.managedKey)) throw DomainError.notFound('Policy');
      return { roleId, managedKey: parsed.managedKey, policyId: null };
    }
    if (!/^[0-9a-f-]{36}$/i.test(parsed.policyId)) throw DomainError.notFound('Policy');
    await this.getCustom(workspaceId, parsed.policyId);
    return { roleId, managedKey: null, policyId: parsed.policyId };
  }
}

function toResponse(policy: CustomPolicy, attachedRoleCount: number): PolicyResponse {
  return { id: policy.id, name: policy.name, description: policy.description, managed: false, document: policy.document, attachedRoleCount };
}

/** A role may never end up able to do or see more than the person changing it. */
function assertWithin(actor: WorkspaceAccess, result: RoleAccess): void {
  if (!result.permissions.every((permission) => actor.permissions.has(permission))) {
    throw DomainError.forbidden('That change would give the role permissions you do not have');
  }
  if (!result.readableFields.every((field) => actor.readableFields.has(field))) {
    throw DomainError.forbidden('That change would let the role see fields you cannot see');
  }
  RoleGrantPolicy.assertKeepsSpaceRules(actor, result);
}
