import type { Permission } from '@taskflow/shared-types';
import { DomainError } from '../../../core/domain/domain-error.js';

/** Only the built-in Owner role may hold this; it controls deleting the workspace. */
export const OWNER_ONLY_PERMISSION: Permission = 'workspace.manage';

/**
 * Stops privilege escalation: nobody can put permissions into a role, or hand a
 * role to someone, unless they already hold every one of those permissions.
 */
export const RoleGrantPolicy = {
  assertCanDefine(held: ReadonlySet<Permission>, requested: readonly Permission[]): void {
    if (requested.includes(OWNER_ONLY_PERMISSION)) {
      throw DomainError.invalid(`${OWNER_ONLY_PERMISSION} is reserved for the Owner role`);
    }
    if (!RoleGrantPolicy.holdsAll(held, requested)) {
      throw DomainError.forbidden('You cannot grant permissions you do not have');
    }
  },

  assertCanHandOut(held: ReadonlySet<Permission>, rolePermissions: readonly Permission[]): void {
    if (!RoleGrantPolicy.holdsAll(held, rolePermissions)) {
      throw DomainError.forbidden('That role has permissions you do not have');
    }
  },

  /** Handing out a role is only allowed when the actor already has everything the role grants, fields included. */
  assertCanHandOutAccess(
    held: { permissions: ReadonlySet<Permission>; readableFields: ReadonlySet<string> },
    role: { permissions: readonly Permission[]; readableFields: readonly string[] },
  ): void {
    RoleGrantPolicy.assertCanHandOut(held.permissions, role.permissions);
    if (!role.readableFields.every((field) => held.readableFields.has(field))) {
      throw DomainError.forbidden('That role can see fields you cannot see');
    }
  },

  holdsAll(held: ReadonlySet<Permission>, permissions: readonly Permission[]): boolean {
    return permissions.every((permission) => held.has(permission));
  },
};
