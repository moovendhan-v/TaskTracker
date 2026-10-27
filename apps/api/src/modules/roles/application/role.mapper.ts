import type { AttachedPolicyResponse, RoleResponse } from '@taskflow/shared-types';
import { findManagedPolicy, PolicyRef, type CustomPolicy, type PolicyAttachment } from '../domain/policy.js';
import type { WorkspaceRole } from '../domain/workspace-role.js';
import type { RoleAccess } from './role-access.service.js';

export const RoleMapper = {
  toResponse(role: WorkspaceRole, attachments: readonly PolicyAttachment[], custom: ReadonlyMap<string, Pick<CustomPolicy, 'name'>>, access: RoleAccess): RoleResponse {
    return {
      id: role.id,
      name: role.name,
      systemKey: role.systemKey,
      permissions: role.permissions,
      inlinePolicy: role.inlinePolicy ?? { statements: [] },
      policies: attachments.flatMap((attachment): AttachedPolicyResponse[] => {
        const name = attachment.managedKey ? findManagedPolicy(attachment.managedKey)?.name : custom.get(attachment.policyId ?? '')?.name;
        return name ? [{ ref: PolicyRef.of(attachment), name, managed: attachment.managedKey !== null }] : [];
      }),
      effectivePermissions: access.permissions,
      readableFields: access.readableFields,
      spaceRules: access.spaceRules,
    };
  },
};
