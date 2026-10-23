import type { Permission, SystemRoleKey } from '@taskflow/shared-types';

export interface WorkspaceRole {
  id: string;
  workspaceId: string;
  name: string;
  /** Set for built-in roles, which can't be renamed or deleted. */
  systemKey: SystemRoleKey | null;
  permissions: Permission[];
  createdAt: Date;
  updatedAt: Date;
}

export type NewWorkspaceRole = Pick<WorkspaceRole, 'workspaceId' | 'name' | 'systemKey' | 'permissions'>;
