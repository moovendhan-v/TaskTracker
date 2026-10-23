import type { AdminUserQuery, AdminWorkspaceQuery, AuditLogQuery, UpdateAdminUserRequest } from '@taskflow/shared-types';
import { AdminAuditLogDocument, AdminUsersDocument, AdminWorkspacesDocument, UpdateAdminUserDocument } from '@taskflow/sdk';
import { graphql } from '@/core/api/graphql-client';

export const adminApi = {
  users: async (query: AdminUserQuery) => (await graphql(AdminUsersDocument, query)).adminUsers,
  updateUser: async (userId: string, input: UpdateAdminUserRequest) =>
    (await graphql(UpdateAdminUserDocument, { userId, input })).updateAdminUser,
  workspaces: async (query: AdminWorkspaceQuery) => (await graphql(AdminWorkspacesDocument, query)).adminWorkspaces,
  auditLog: async (query: AuditLogQuery) => (await graphql(AdminAuditLogDocument, query)).adminAuditLog,
};
