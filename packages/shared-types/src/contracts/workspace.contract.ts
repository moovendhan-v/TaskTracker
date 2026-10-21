import type { WorkspaceRole } from '../domain/workspace.js';

export interface WorkspaceResponse {
  id: string;
  name: string;
  color: string;
  role: WorkspaceRole;
  createdAt: string;
}

export interface CreateWorkspaceRequest {
  name: string;
  color?: string;
}

export type UpdateWorkspaceRequest = Partial<CreateWorkspaceRequest>;
