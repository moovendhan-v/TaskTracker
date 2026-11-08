import type { Permission } from './permissions.js';

/**
 * A4 / E3: a workspace can require two-step sign-in (an authenticator app or a
 * passkey). Members without it keep their membership but lose the permissions the
 * requirement covers until they set it up: admin rights only, or everything.
 */
export const TWO_STEP_REQUIREMENTS = ['off', 'admins', 'everyone'] as const;
export type TwoStepRequirement = (typeof TWO_STEP_REQUIREMENTS)[number];

export function isTwoStepRequirement(value: unknown): value is TwoStepRequirement {
  return typeof value === 'string' && (TWO_STEP_REQUIREMENTS as readonly string[]).includes(value);
}

/** Permissions that make someone an admin: they change who can do what, or see everything that happened. */
export const ADMIN_PERMISSIONS: readonly Permission[] = ['workspace.manage', 'members.manage', 'roles.manage', 'integration.manage', 'audit.view'];

/** The permissions a member keeps while the requirement applies to them and they haven't set up two-step sign-in. */
export function permissionsWithoutTwoStep(requirement: TwoStepRequirement, permissions: Iterable<Permission>): Permission[] {
  if (requirement === 'everyone') return [];
  const kept = [...permissions];
  if (requirement === 'off') return kept;
  return kept.filter((permission) => !ADMIN_PERMISSIONS.includes(permission));
}

export interface TwoStepPolicyResponse {
  /** The workspace id. */
  id: string;
  workspaceId: string;
  require: TwoStepRequirement;
  /** The rule of the organization the workspace is in (A3); the stricter of the two applies. */
  organizationRequire: TwoStepRequirement | null;
  organizationName: string | null;
  /** Whether the caller has two-step sign-in (an authenticator app or a passkey). */
  callerHasTwoStep: boolean;
}
