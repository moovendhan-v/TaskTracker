import type { SpaceRule } from '../domain/iam.js';
import type { Permission } from '../domain/permissions.js';

export interface WorkspaceResponse {
  id: string;
  name: string;
  color: string;
  roleName: string;
  /** The caller's effective permissions in this workspace, for showing or hiding UI. */
  permissions: Permission[];
  /** Spaces where some of `permissions` are taken away (see canInSpace). */
  spaceRules: SpaceRule[];
  /** The workspace requires two-step sign-in and the caller hasn't set it up, so some permissions are held back. */
  twoStepMissing: boolean;
  createdAt: string;
}

export interface CreateWorkspaceRequest {
  name: string;
  color?: string;
}

export type UpdateWorkspaceRequest = Partial<CreateWorkspaceRequest>;
