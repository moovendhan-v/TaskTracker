import type { AuditLogQuery } from '@taskflow/shared-types';
import { WorkspaceAuditLogDocument } from '@taskflow/sdk';
import { graphql } from '@/core/api/graphql-client';

export const auditLogApi = {
  forWorkspace: async (workspaceId: string, query: AuditLogQuery) =>
    (await graphql(WorkspaceAuditLogDocument, { ...query, workspaceId })).workspaceAuditLog,
};
