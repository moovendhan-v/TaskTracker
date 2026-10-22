import type { AdminUserQuery, AdminWorkspaceQuery, AuditLogQuery, UpdateAdminUserRequest } from '@taskflow/shared-types';
import { unwrap } from '@taskflow/sdk';
import { api } from '@/core/api/sdk-client';

export const adminApi = {
  users: (query: AdminUserQuery) => unwrap(api.GET('/api/admin/users', { params: { query } })),
  updateUser: (userId: string, body: UpdateAdminUserRequest) =>
    unwrap(api.PATCH('/api/admin/users/{userId}', { params: { path: { userId } }, body })),
  workspaces: (query: AdminWorkspaceQuery) => unwrap(api.GET('/api/admin/workspaces', { params: { query } })),
  auditLog: (query: AuditLogQuery) => unwrap(api.GET('/api/admin/audit-log', { params: { query } })),
};
