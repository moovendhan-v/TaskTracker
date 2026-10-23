import type { AdminUserResponse, AdminWorkspaceResponse } from '@taskflow/shared-types';
import type { AdminUser, AdminWorkspace } from '../domain/admin-user.js';

export const AdminMapper = {
  user(user: AdminUser): AdminUserResponse {
    return {
      id: user.id,
      name: user.name,
      email: user.email,
      platformRole: user.platformRole,
      suspended: user.suspended,
      workspaceCount: user.workspaceCount,
      createdAt: user.createdAt.toISOString(),
    };
  },

  workspace(workspace: AdminWorkspace): AdminWorkspaceResponse {
    return {
      id: workspace.id,
      name: workspace.name,
      ownerId: workspace.ownerId,
      ownerName: workspace.ownerName,
      memberCount: workspace.memberCount,
      createdAt: workspace.createdAt.toISOString(),
    };
  },
};
