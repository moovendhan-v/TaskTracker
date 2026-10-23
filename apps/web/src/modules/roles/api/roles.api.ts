import { parsePermissions, type CreateRoleRequest, type UpdateRoleRequest } from '@taskflow/shared-types';
import { CreateRoleDocument, DeleteRoleDocument, RolesDocument, UpdateRoleDocument, type RoleFieldsFragment } from '@taskflow/sdk';
import { graphql } from '@/core/api/graphql-client';

/** Permission keys arrive as strings; unknown keys are dropped rather than trusted. */
const toRole = (role: RoleFieldsFragment) => ({ ...role, permissions: parsePermissions(role.permissions) });

export const rolesApi = {
  list: async (workspaceId: string) => (await graphql(RolesDocument, { workspaceId })).roles.map(toRole),
  create: async (workspaceId: string, input: CreateRoleRequest) =>
    toRole((await graphql(CreateRoleDocument, { workspaceId, input })).createRole),
  update: async (workspaceId: string, roleId: string, input: UpdateRoleRequest) =>
    toRole((await graphql(UpdateRoleDocument, { workspaceId, roleId, input })).updateRole),
  remove: async (workspaceId: string, roleId: string) => (await graphql(DeleteRoleDocument, { workspaceId, roleId })).deleteRole,
};
