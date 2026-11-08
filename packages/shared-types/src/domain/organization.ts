import type { TwoStepRequirement } from './two-step.js';

/** A3: organizations above workspaces. See docs/plan/A3_ORGANIZATIONS.md. */
export const ORG_ROLES = ['owner', 'admin', 'member'] as const;
export type OrgRole = (typeof ORG_ROLES)[number];
export const ORG_NAME_MAX = 80;

export function isOrgRole(value: unknown): value is OrgRole {
  return typeof value === 'string' && (ORG_ROLES as readonly string[]).includes(value);
}

/** Owners and admins run the organization; members see it. */
export function canManageOrg(role: OrgRole | null): boolean {
  return role === 'owner' || role === 'admin';
}

export interface OrganizationResponse {
  id: string;
  name: string;
  /** The caller's role in it. */
  role: OrgRole;
  twoStepRequired: TwoStepRequirement;
  createdAt: string;
}

export interface OrganizationMemberResponse {
  userId: string;
  name: string;
  email: string;
  role: OrgRole;
  /** Whether they have two-step sign-in (an authenticator app or a passkey). */
  hasTwoStep: boolean;
  joinedAt: string;
}

export interface OrganizationWorkspaceResponse {
  id: string;
  name: string;
  color: string;
}

export interface OrganizationActivityResponse {
  id: string;
  action: string;
  actorName: string | null;
  targetType: string;
  metadata: Record<string, unknown>;
  createdAt: string;
}

/** The stricter of a workspace's own two-step rule and its organization's. */
export function stricterTwoStep(a: TwoStepRequirement, b: TwoStepRequirement | null | undefined): TwoStepRequirement {
  const order: readonly TwoStepRequirement[] = ['off', 'admins', 'everyone'];
  return b && order.indexOf(b) > order.indexOf(a) ? b : a;
}
