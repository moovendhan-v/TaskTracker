import {
  MANAGED_POLICIES,
  evaluatePolicies,
  isSpaceScoped,
  type Permission,
  type SpaceScopedPermission,
  type EffectiveAccess,
  type ManagedPolicy,
  type PolicyDocument,
} from '@taskflow/shared-types';
import type { WorkspaceRole } from './workspace-role.js';

/** A workspace's own reusable policy. */
export interface CustomPolicy {
  id: string;
  workspaceId: string;
  name: string;
  description: string;
  document: PolicyDocument;
  createdById: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export type NewCustomPolicy = Pick<CustomPolicy, 'workspaceId' | 'name' | 'description' | 'document' | 'createdById'>;

/** A role's use of a policy: managed (by key) or custom (by id). */
export interface PolicyAttachment {
  roleId: string;
  managedKey: string | null;
  policyId: string | null;
}

const MANAGED_PREFIX = 'managed:';

/** How clients refer to any policy: `managed:FullAccess` or a custom policy's id. */
export const PolicyRef = {
  managed: (key: string) => `${MANAGED_PREFIX}${key}`,
  of: (attachment: Pick<PolicyAttachment, 'managedKey' | 'policyId'>) =>
    attachment.managedKey ? `${MANAGED_PREFIX}${attachment.managedKey}` : (attachment.policyId ?? ''),
  parse(ref: string): { managedKey: string } | { policyId: string } {
    return ref.startsWith(MANAGED_PREFIX) ? { managedKey: ref.slice(MANAGED_PREFIX.length) } : { policyId: ref };
  },
};

export function findManagedPolicy(key: string): ManagedPolicy | undefined {
  return MANAGED_POLICIES.find((policy) => policy.key === key);
}

/**
 * Every policy document that applies to a role: its direct permissions, its
 * inline statements and each attached policy. Attachments to policies that no
 * longer exist contribute nothing.
 */
export function documentsForRole(
  role: Pick<WorkspaceRole, 'permissions' | 'inlinePolicy'>,
  attachments: readonly PolicyAttachment[],
  customPolicies: ReadonlyMap<string, Pick<CustomPolicy, 'document'>>,
): PolicyDocument[] {
  const documents: PolicyDocument[] = [{ statements: [{ effect: 'allow', permissions: role.permissions }] }, role.inlinePolicy];
  for (const attachment of attachments) {
    const document = attachment.managedKey ? findManagedPolicy(attachment.managedKey)?.document : customPolicies.get(attachment.policyId ?? '')?.document;
    if (document) documents.push(document);
  }
  return documents;
}

export function effectiveAccessForRole(
  role: Pick<WorkspaceRole, 'permissions' | 'inlinePolicy'>,
  attachments: readonly PolicyAttachment[],
  customPolicies: ReadonlyMap<string, Pick<CustomPolicy, 'document'>>,
): EffectiveAccess {
  return evaluatePolicies(documentsForRole(role, attachments, customPolicies));
}

/** A time-limited grant that is still running (E3): one permission, in one space or everywhere. */
export interface ActiveGrant {
  permission: Permission;
  spaceId: string | null;
}

/**
 * A role's access plus its holder's running grants. Grants only add allows, so a
 * deny in the role still wins. A grant for one space gives the permission only
 * there (as a "denied everywhere else" rule), unless the role already has it, in
 * which case nothing changes and the role's own space denies keep applying.
 * Grants of permissions that don't apply in a space are only honoured workspace-wide.
 */
export function effectiveAccessWithGrants(documents: readonly PolicyDocument[], grants: readonly ActiveGrant[]): EffectiveAccess {
  const allow = (permissions: readonly Permission[]): PolicyDocument => ({ statements: permissions.length ? [{ effect: 'allow', permissions: [...permissions] }] : [] });
  const everywhere = [...new Set(grants.filter((grant) => grant.spaceId === null).map((grant) => grant.permission))];
  const base = evaluatePolicies([...documents, allow(everywhere)]);
  const spaced = grants.filter((grant): grant is { permission: SpaceScopedPermission; spaceId: string } => grant.spaceId !== null && isSpaceScoped(grant.permission) && !base.permissions.includes(grant.permission));
  if (spaced.length === 0) return base;
  // Would the role allow these at all once granted (no workspace-wide deny)?
  const withSpaced = evaluatePolicies([...documents, allow([...everywhere, ...spaced.map((grant) => grant.permission)])]);
  const onlyIn = new Map<SpaceScopedPermission, string[]>();
  for (const grant of spaced) {
    if (!withSpaced.permissions.includes(grant.permission)) continue;
    onlyIn.set(grant.permission, [...new Set([...(onlyIn.get(grant.permission) ?? []), grant.spaceId])]);
  }
  return {
    ...base,
    permissions: [...base.permissions, ...onlyIn.keys()],
    spaceRules: [...base.spaceRules, ...[...onlyIn].map(([permission, spaces]) => ({ spaces: null, notSpaces: spaces, permissions: [permission] }))],
  };
}
