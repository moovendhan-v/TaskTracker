import type { RoleResponse } from '@taskflow/shared-types';
import type { WorkspaceRole } from '../domain/workspace-role.js';

export const RoleMapper = {
  toResponse(role: WorkspaceRole): RoleResponse {
    return { id: role.id, name: role.name, systemKey: role.systemKey, permissions: role.permissions };
  },
};
