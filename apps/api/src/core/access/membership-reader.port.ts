import type { Permission, SpaceRule, TwoStepRequirement } from '@taskflow/shared-types';

export interface MembershipGrant {
  roleId: string;
  /** Effective permissions after every policy and deny. */
  permissions: readonly Permission[];
  /** Protected fields the member may read. */
  readableFields: readonly string[];
  /** Space-limited denies (see SpaceRule). */
  spaceRules: readonly SpaceRule[];
  /** Whether the workspace requires two-step sign-in, and of whom (A4 / E3). */
  twoStep: TwoStepRequirement;
}

/**
 * What the access layer needs to know about memberships. Core defines the port;
 * the members module provides the adapter, so core never imports a feature module.
 */
export abstract class MembershipReader {
  abstract findGrant(workspaceId: string, userId: string): Promise<MembershipGrant | null>;
  abstract workspaceExists(workspaceId: string): Promise<boolean>;
  /**
   * Whether the user has two-step sign-in: an authenticator app or a passkey. Never cached,
   * so turning it on or off counts at once.
   */
  abstract hasTwoStep(userId: string): Promise<boolean>;
}
