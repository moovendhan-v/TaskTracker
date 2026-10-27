import { Injectable } from '@nestjs/common';
import { PERMISSIONS, PROTECTED_FIELDS, type Permission } from '@taskflow/shared-types';
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
      return {
        workspaceId,
        roleId: grant.roleId,
        permissions: new Set(grant.permissions),
        readableFields: new Set(grant.readableFields),
        spaceRules: grant.spaceRules,
        viaPlatformRole: false,
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

  static hasAll(access: WorkspaceAccess, required: readonly Permission[]): boolean {
    return required.every((permission) => access.permissions.has(permission));
  }
}
