import type { CustomPolicy, NewCustomPolicy, PolicyAttachment } from './policy.js';

export abstract class PolicyRepository {
  abstract list(workspaceId: string): Promise<CustomPolicy[]>;
  abstract findInWorkspace(workspaceId: string, policyId: string): Promise<CustomPolicy | null>;
  /** Custom policies by id; missing ids are left out. */
  abstract findMany(workspaceId: string, policyIds: readonly string[]): Promise<CustomPolicy[]>;
  abstract create(policy: NewCustomPolicy): Promise<CustomPolicy>;
  abstract save(policy: CustomPolicy): Promise<CustomPolicy>;
  abstract delete(workspaceId: string, policyId: string): Promise<void>;
  /** Attachments for some roles, or for every role in the workspace. */
  abstract listAttachments(workspaceId: string, roleIds?: readonly string[]): Promise<PolicyAttachment[]>;
  /** Returns false when the role already has that policy. */
  abstract attach(workspaceId: string, attachment: PolicyAttachment): Promise<boolean>;
  /** Returns false when the role didn't have that policy. */
  abstract detach(workspaceId: string, attachment: PolicyAttachment): Promise<boolean>;
}
