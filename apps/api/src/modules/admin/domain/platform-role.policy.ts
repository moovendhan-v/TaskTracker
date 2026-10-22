import type { PlatformRole } from '@taskflow/shared-types';
import { DomainError } from '../../../core/domain/domain-error.js';

interface Change {
  actorId: string;
  target: { id: string; platformRole: PlatformRole; suspended: boolean };
  next: { platformRole?: PlatformRole; suspended?: boolean };
  /** Active (not suspended) super admins, counted under lock. */
  activeSuperAdmins: number;
}

/** Guards platform-level account changes. */
export const PlatformRolePolicy = {
  assertAllowed({ actorId, target, next, activeSuperAdmins }: Change): void {
    if (actorId === target.id) throw DomainError.forbidden('You can’t change your own platform access');

    const isActiveSuperAdmin = target.platformRole === 'SUPER_ADMIN' && !target.suspended;
    const losesSuperAdmin = next.platformRole === 'USER' || next.suspended === true;
    if (isActiveSuperAdmin && losesSuperAdmin && activeSuperAdmins <= 1) {
      throw DomainError.invalid('The platform needs at least one active super admin');
    }
  },
};
