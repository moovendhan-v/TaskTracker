import type { Permission } from '@taskflow/shared-types';

export interface MembershipGrant {
  roleId: string;
  permissions: readonly Permission[];
}

/**
 * What the access layer needs to know about memberships. Core defines the port;
 * the members module provides the adapter, so core never imports a feature module.
 */
export abstract class MembershipReader {
  abstract findGrant(workspaceId: string, userId: string): Promise<MembershipGrant | null>;
  abstract workspaceExists(workspaceId: string): Promise<boolean>;
}
