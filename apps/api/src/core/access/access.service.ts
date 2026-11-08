import { Injectable } from '@nestjs/common';
import { PERMISSIONS, permissionsWithoutTwoStep, PROTECTED_FIELDS, type Permission } from '@taskflow/shared-types';
import type { SessionUser, WorkspaceAccess } from '../http/types/authenticated-request.js';
import { MembershipReader } from './membership-reader.port.js';

/** Single place that decides what a user may do inside a workspace. */
@Injectable()
export class AccessService {
  constructor(private readonly memberships: MembershipReader) {}

  /** Returns null when the user has no access, so callers answer 404 and don't reveal the workspace exists. */
  async resolve(user: SessionUser, workspaceId: string): Promise<WorkspaceAccess | null> {
    const grant = await this.memberships.findGrant(workspaceId, user.id);
    if (grant) {
      // A4 / E3: a workspace that requires two-step sign-in holds back what the requirement
      // covers until the member sets it up. Checked on every request, so it counts at once.
      const permissions = grant.twoStep !== 'off' && !(await this.memberships.hasTwoStep(user.id)) ? permissionsWithoutTwoStep(grant.twoStep, grant.permissions) : grant.permissions;
      // Only when something is actually held back: "admins" changes nothing for a plain member.
      const twoStepMissing = permissions.length < grant.permissions.length;
      return {
        workspaceId,
        roleId: grant.roleId,
        permissions: new Set(permissions),
        readableFields: new Set(grant.readableFields),
        spaceRules: grant.spaceRules,
        viaPlatformRole: false,
        twoStepMissing,
      };
    }
    if (user.platformRole === 'SUPER_ADMIN' && (await this.memberships.workspaceExists(workspaceId))) {
      return {
        workspaceId,
        roleId: null,
        permissions: new Set(PERMISSIONS),
        readableFields: new Set(PROTECTED_FIELDS.map((field) => field.key)),
        spaceRules: [],
        viaPlatformRole: true,
      };
    }
    return null;
  }

  /**
   * A member's own access, never a platform role's: for work done on someone's
   * behalf without a request, such as automations and integrations.
   */
  resolveMember(userId: string, workspaceId: string): Promise<WorkspaceAccess | null> {
    return this.resolve({ id: userId, email: '', name: '', image: null, platformRole: 'USER', emailVerified: true }, workspaceId);
  }

  /** Whether the user has two-step sign-in (an authenticator app or a passkey). */
  hasTwoStep(userId: string): Promise<boolean> {
    return this.memberships.hasTwoStep(userId);
  }

  static hasAll(access: WorkspaceAccess, required: readonly Permission[]): boolean {
    return required.every((permission) => access.permissions.has(permission));
  }
}
