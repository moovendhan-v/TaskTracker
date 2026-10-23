import type { Permission } from '../domain/permissions.js';

export interface WorkspaceResponse {
  id: string;
  name: string;
  color: string;
  roleName: string;
  /** The caller's effective permissions in this workspace, for showing or hiding UI. */
  permissions: Permission[];
  createdAt: string;
}

export interface CreateWorkspaceRequest {
  name: string;
  color?: string;
}

export type UpdateWorkspaceRequest = Partial<CreateWorkspaceRequest>;
