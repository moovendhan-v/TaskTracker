import {
  MANAGED_POLICIES,
  evaluatePolicies,
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
