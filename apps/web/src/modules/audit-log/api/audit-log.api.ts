import type { AuditLogQuery } from '@taskflow/shared-types';
import { unwrap } from '@taskflow/sdk';
import { api } from '@/core/api/sdk-client';

export const auditLogApi = {
  forWorkspace: (workspaceId: string, query: AuditLogQuery) =>
    unwrap(api.GET('/api/workspaces/{workspaceId}/audit-log', { params: { path: { workspaceId }, query } })),
};
