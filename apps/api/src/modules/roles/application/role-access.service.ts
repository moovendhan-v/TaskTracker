import { Injectable } from '@nestjs/common';
import type { EffectiveAccess, LabelledPolicy, Permission, SpaceRule } from '@taskflow/shared-types';
import { Cached } from '../../../core/cache/cached.decorator.js';
import { effectiveAccessForRole, findManagedPolicy, type CustomPolicy, type PolicyAttachment } from '../domain/policy.js';
import { PolicyDocumentPolicy } from '../domain/policy-document.policy.js';
import { PolicyRepository } from '../domain/policy.repository.js';
import type { WorkspaceRole } from '../domain/workspace-role.js';
import { WorkspaceRoleRepository } from '../domain/workspace-role.repository.js';

/** What one role adds up to, in a cache-friendly shape. */
export interface RoleAccess {
  permissions: Permission[];
  readableFields: string[];
  /** Space-limited denies on top of `permissions`. */
  spaceRules: SpaceRule[];
}

/** Works out what roles can do from their permissions, inline statements and attached policies. */
@Injectable()
export class RoleAccessService {
  constructor(
    private readonly roles: WorkspaceRoleRepository,
    private readonly policies: PolicyRepository,
  ) {}

  /**
   * One role's effective access. Runs in user scope too (access checks), where
   * row-level security shows only the roles and policies the user holds, so it
   * only ever loads the one role. Cached per role and dropped on role or policy changes.
   */
  @Cached({ entities: ['role', 'policy'], shared: true })
  async forRole(workspaceId: string, roleId: string): Promise<RoleAccess | null> {
    const role = await this.roles.findInWorkspace(workspaceId, roleId);
    if (!role) return null;
    const attachments = await this.policies.listAttachments(workspaceId, [roleId]);
    return toRoleAccess(await this.evaluate(workspaceId, role, attachments));
  }

  /**
   * Every policy document a role gets its rights from, named for people: its own
   * permissions, its inline statements, and each attached policy. For explaining
   * decisions (the access checker); evaluates the same documents as forRole.
   */
  async labelledPolicies(workspaceId: string, roleId: string): Promise<{ roleName: string; policies: LabelledPolicy[] } | null> {
    const role = await this.roles.findInWorkspace(workspaceId, roleId);
    if (!role) return null;
    const attachments = await this.policies.listAttachments(workspaceId, [roleId]);
    const custom = new Map((await this.policies.findMany(workspaceId, attachments.flatMap((item) => (item.policyId ? [item.policyId] : [])))).map((policy) => [policy.id, policy]));
    const policies: LabelledPolicy[] = [
      { source: `Role “${role.name}”: its permissions`, document: { statements: [{ effect: 'allow', permissions: role.permissions }] } },
      { source: `Role “${role.name}”: its own statements`, document: role.inlinePolicy },
    ];
    for (const attachment of attachments) {
      const managed = attachment.managedKey ? findManagedPolicy(attachment.managedKey) : undefined;
      const own = attachment.policyId ? custom.get(attachment.policyId) : undefined;
      if (managed) policies.push({ source: `Managed policy “${managed.name}”`, document: managed.document });
      if (own) policies.push({ source: `Policy “${own.name}”`, document: own.document });
    }
    return { roleName: role.name, policies };
  }

  /** Effective access of a role after a change that hasn't been saved yet, for escalation checks. */
  async preview(workspaceId: string, role: WorkspaceRole, attachments: readonly PolicyAttachment[], overrides: ReadonlyMap<string, CustomPolicy> = new Map()): Promise<RoleAccess> {
    return toRoleAccess(await this.evaluate(workspaceId, role, attachments, overrides));
  }

  private async evaluate(
    workspaceId: string,
    role: WorkspaceRole,
    attachments: readonly PolicyAttachment[],
    overrides: ReadonlyMap<string, CustomPolicy> = new Map(),
  ): Promise<EffectiveAccess> {
    const customIds = attachments.flatMap((attachment) => (attachment.policyId && !overrides.has(attachment.policyId) ? [attachment.policyId] : []));
    const custom = new Map((await this.policies.findMany(workspaceId, customIds)).map((policy) => [policy.id, policy]));
    for (const [id, policy] of overrides) custom.set(id, policy);
    return effectiveAccessForRole(role, attachments, custom);
  }
}

function toRoleAccess(access: EffectiveAccess): RoleAccess {
  return { permissions: access.permissions, readableFields: PolicyDocumentPolicy.readableFields(access), spaceRules: access.spaceRules };
}
