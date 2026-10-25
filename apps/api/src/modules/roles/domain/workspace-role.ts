import type { Permission, PolicyDocument, SystemRoleKey } from '@taskflow/shared-types';

export interface WorkspaceRole {
  id: string;
  workspaceId: string;
  name: string;
  /** Set for built-in roles, which can't be renamed or deleted. */
  systemKey: SystemRoleKey | null;
  /** Permissions granted directly on the role. */
  permissions: Permission[];
  /** Statements that belong to this role only (denies, field rules). */
  inlinePolicy: PolicyDocument;
  createdAt: Date;
  updatedAt: Date;
}

export type NewWorkspaceRole = Pick<WorkspaceRole, 'workspaceId' | 'name' | 'systemKey' | 'permissions'> & Partial<Pick<WorkspaceRole, 'inlinePolicy'>>;
