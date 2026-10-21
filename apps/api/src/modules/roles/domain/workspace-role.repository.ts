import type { NewWorkspaceRole, WorkspaceRole } from './workspace-role.js';

export abstract class WorkspaceRoleRepository {
  abstract listByWorkspace(workspaceId: string): Promise<WorkspaceRole[]>;
  abstract findInWorkspace(workspaceId: string, roleId: string): Promise<WorkspaceRole | null>;
  abstract create(role: NewWorkspaceRole): Promise<WorkspaceRole>;
  abstract createMany(roles: NewWorkspaceRole[]): Promise<WorkspaceRole[]>;
  abstract save(role: WorkspaceRole): Promise<WorkspaceRole>;
  abstract delete(workspaceId: string, roleId: string): Promise<void>;
  /** True when any member of the workspace holds this role. */
  abstract isAssigned(workspaceId: string, roleId: string): Promise<boolean>;
}
