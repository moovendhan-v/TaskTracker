import type { Permission, SystemRoleKey } from '@taskflow/shared-types';

export interface WorkspaceMember {
  id: string;
  workspaceId: string;
  userId: string;
  roleId: string;
  createdAt: Date;
  updatedAt: Date;
}

export type NewWorkspaceMember = Pick<WorkspaceMember, 'workspaceId' | 'userId' | 'roleId'>;

/** A membership joined with its role, used for access checks and role changes. */
export interface MembershipWithRole {
  workspaceId: string;
  userId: string;
  roleId: string;
  roleName: string;
  roleSystemKey: SystemRoleKey | null;
  permissions: Permission[];
}

/** A membership joined with the user's profile, used for listing members. */
export interface MemberDetails {
  userId: string;
  name: string;
  email: string;
  roleId: string;
  roleName: string;
  joinedAt: Date;
}
