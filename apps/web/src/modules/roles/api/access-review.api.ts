import { ExplainAccessDocument, ExplainMyAccessDocument, RequestAccessDocument } from '@taskflow/sdk';
import { graphql } from '@/core/api/graphql-client';

export const accessReviewApi = {
  /** Any member's access (needs roles.manage). */
  explain: async (workspaceId: string, userId: string, permission: string, spaceId: string | null) => (await graphql(ExplainAccessDocument, { workspaceId, userId, permission, spaceId })).explainAccess,
  mine: async (workspaceId: string, permission: string, spaceId: string | null) => (await graphql(ExplainMyAccessDocument, { workspaceId, permission, spaceId })).explainMyAccess,
  request: async (workspaceId: string, input: { permission: string; spaceId?: string | null; note?: string }) => (await graphql(RequestAccessDocument, { workspaceId, input })).requestAccess,
};
