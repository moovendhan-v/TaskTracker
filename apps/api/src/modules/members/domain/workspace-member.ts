import type { SystemRoleKey } from '@taskflow/shared-types';

export interface WorkspaceMember {
  id: string;
  workspaceId: string;
  userId: string;
  roleId: string;
  createdAt: Date;
  updatedAt: Date;
}

export type NewWorkspaceMember = Pick<WorkspaceMember, 'workspaceId' | 'userId' | 'roleId'>;

/** A membership joined with its role. What the role allows comes from RoleAccessService (policies). */
export interface MembershipWithRole {
  workspaceId: string;
  userId: string;
  roleId: string;
  roleName: string;
  roleSystemKey: SystemRoleKey | null;
}

/** A membership joined with the user's profile, used for listing members. */
export interface MemberDetails {
  userId: string;
  name: string;
  /** Protected (`member.email`): the API returns null to callers who may not read it. */
  email: string;
  roleId: string;
  roleName: string;
  joinedAt: Date;
}
