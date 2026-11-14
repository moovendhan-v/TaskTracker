import { deniedInSpace, type SpaceScopedPermission } from '@taskflow/shared-types';
import { DomainError } from '../domain/domain-error.js';
import { TransactionalManager } from '../database/transactional-manager.js';
import { lookupProvider } from '../runtime/decorator-runtime.js';

/**
 * Space-level checks for services. The workspace guard has already checked the
 * permission itself; this applies the caller's space-limited denies (IAM
 * statements with `spaces` or `notSpaces`), read from the operation's data
 * scope. Seeing a space is enforced by row-level security; this covers what
 * the database can't tell apart, such as editing versus viewing.
 *
 * Work outside a member's request (operator CLIs, the demo seed, plain unit
 * tests) has no space limits.
 */
export const SpaceGuard = {
  allowed(spaceId: string, permission: SpaceScopedPermission): boolean {
    const scope = lookupProvider(TransactionalManager)?.scope;
    if (scope?.kind !== 'workspace' || !scope.spaceRules?.length) return true;
    return !deniedInSpace(scope.spaceRules, spaceId, permission);
  },

  /** Throws FORBIDDEN unless the caller may use `permission` inside `spaceId`. */
  assert(spaceId: string, permission: SpaceScopedPermission): void {
    if (!SpaceGuard.allowed(spaceId, permission)) throw DomainError.missingPermission(permission, spaceId, `Your role can’t use ${permission} in this space`);
  },
};
