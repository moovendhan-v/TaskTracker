import { Injectable } from '@nestjs/common';
import type { EffectiveAccess, Permission, SpaceRule } from '@taskflow/shared-types';
import { Cached } from '../../../core/cache/cached.decorator.js';
import { effectiveAccessForRole, type CustomPolicy, type PolicyAttachment } from '../domain/policy.js';
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
