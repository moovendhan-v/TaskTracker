import { SYSTEM_ROLE_KEYS, SYSTEM_ROLE_PERMISSIONS, type SystemRoleKey } from '@taskflow/shared-types';
import type { WorkspaceRoleEntity } from './entities/workspace-role.entity.js';

const SYSTEM_ROLE_NAMES: Record<SystemRoleKey, string> = {
  owner: 'Owner',
  admin: 'Admin',
  member: 'Member',
  guest: 'Guest',
};

/** Built-in roles every new workspace starts with. */
export function buildSystemRoles(workspaceId: string): Partial<WorkspaceRoleEntity>[] {
  return SYSTEM_ROLE_KEYS.map((key) => ({
    workspaceId,
    systemKey: key,
    name: SYSTEM_ROLE_NAMES[key],
    permissions: [...SYSTEM_ROLE_PERMISSIONS[key]],
  }));
}
