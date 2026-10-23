import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { AdminUserQuery, AdminWorkspaceQuery, AuditLogQuery, UpdateAdminUserRequest } from '@taskflow/shared-types';
import { toast } from '@/components/ui/sonner';
import { getErrorMessage } from '@/lib/errors';
import { queryKeys } from '@/lib/query-keys';
import { adminApi } from '../api/admin.api';

export function useAdminUsers(query: AdminUserQuery) {
  return useQuery({ queryKey: queryKeys.adminUsers(query), queryFn: () => adminApi.users(query), placeholderData: (previous) => previous });
}

export function useAdminWorkspaces(query: AdminWorkspaceQuery) {
  return useQuery({ queryKey: queryKeys.adminWorkspaces(query), queryFn: () => adminApi.workspaces(query), placeholderData: (previous) => previous });
}

export function useAdminAuditLog(query: AuditLogQuery) {
  return useQuery({ queryKey: queryKeys.adminAudit(query), queryFn: () => adminApi.auditLog(query), placeholderData: (previous) => previous });
}

export function useUpdateAdminUser() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ userId, body }: { userId: string; body: UpdateAdminUserRequest }) => adminApi.updateUser(userId, body),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.adminRoot }),
    onError: (error) => toast.error(getErrorMessage(error)),
  });
}
