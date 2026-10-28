import { PERMISSIONS, type Permission, type SpaceRule, type WorkspaceResponse } from '@taskflow/shared-types';
import type { Workspace } from '../domain/workspace.js';

export const WorkspaceMapper = {
  /** Includes the caller's role and permissions so the UI can show or hide actions. */
  toResponse(workspace: Workspace, roleName: string, permissions: Iterable<Permission>, spaceRules: readonly SpaceRule[] = []): WorkspaceResponse {
    const granted = new Set(permissions);
    return {
      id: workspace.id,
      name: workspace.name,
      color: workspace.color,
      roleName,
      permissions: PERMISSIONS.filter((permission) => granted.has(permission)),
      spaceRules: [...spaceRules],
      createdAt: workspace.createdAt.toISOString(),
    };
  },
};
