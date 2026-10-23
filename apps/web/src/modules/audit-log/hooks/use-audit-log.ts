import { useQuery } from '@tanstack/react-query';
import type { AuditLogQuery } from '@taskflow/shared-types';
import { queryKeys } from '@/lib/query-keys';
import { auditLogApi } from '../api/audit-log.api';

export function useWorkspaceAuditLog(workspaceId: string, query: AuditLogQuery) {
  return useQuery({
    queryKey: queryKeys.workspaceAudit(workspaceId, query),
    queryFn: () => auditLogApi.forWorkspace(workspaceId, query),
    placeholderData: (previous) => previous,
  });
}
