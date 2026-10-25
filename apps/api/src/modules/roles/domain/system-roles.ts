import { SYSTEM_ROLE_KEYS, type SystemRoleKey } from '@taskflow/shared-types';
import type { NewWorkspaceRole, WorkspaceRole } from './workspace-role.js';

const SYSTEM_ROLE_NAMES: Record<SystemRoleKey, string> = {
  owner: 'Owner',
  admin: 'Admin',
  member: 'Member',
  guest: 'Guest',
};

/** Built-in roles every new workspace starts with. Their rights come from managed policies (SYSTEM_ROLE_POLICIES). */
export function buildSystemRoles(workspaceId: string): NewWorkspaceRole[] {
  return SYSTEM_ROLE_KEYS.map((key) => ({
    workspaceId,
    systemKey: key,
    name: SYSTEM_ROLE_NAMES[key],
    permissions: [],
  }));
}

/** Built-in roles first, from most to least powerful, then custom roles by name. */
export function compareRoles(a: WorkspaceRole, b: WorkspaceRole): number {
  const rank = (role: WorkspaceRole) =>
    role.systemKey ? SYSTEM_ROLE_KEYS.indexOf(role.systemKey) : SYSTEM_ROLE_KEYS.length;
  return rank(a) - rank(b) || a.name.localeCompare(b.name);
}
