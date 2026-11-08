import { AccessGrantsDocument, AccessRequestsDocument, DecideAccessRequestDocument, ExplainAccessDocument, ExplainMyAccessDocument, RequestAccessDocument, RevokeAccessGrantDocument } from '@taskflow/sdk';
import { graphql } from '@/core/api/graphql-client';

export const accessReviewApi = {
  /** Any member's access (needs roles.manage). */
  explain: async (workspaceId: string, userId: string, permission: string, spaceId: string | null) => (await graphql(ExplainAccessDocument, { workspaceId, userId, permission, spaceId })).explainAccess,
  mine: async (workspaceId: string, permission: string, spaceId: string | null) => (await graphql(ExplainMyAccessDocument, { workspaceId, permission, spaceId })).explainMyAccess,
  request: async (workspaceId: string, input: { permission: string; spaceId?: string | null; note?: string }) => (await graphql(RequestAccessDocument, { workspaceId, input })).requestAccess,
  /** Requests waiting for a decision (roles.manage). */
  requests: async (workspaceId: string) => (await graphql(AccessRequestsDocument, { workspaceId })).accessRequests,
  /** Time-limited grants still running (roles.manage). */
  grants: async (workspaceId: string) => (await graphql(AccessGrantsDocument, { workspaceId })).accessGrants,
  decide: async (workspaceId: string, requestId: string, approve: boolean, days: number | null) => (await graphql(DecideAccessRequestDocument, { workspaceId, requestId, approve, days })).decideAccessRequest,
  revoke: async (workspaceId: string, grantId: string) => (await graphql(RevokeAccessGrantDocument, { workspaceId, grantId })).revokeAccessGrant,
};
