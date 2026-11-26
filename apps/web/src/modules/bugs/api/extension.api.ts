import { ApiTokensDocument, ApproveExtensionConnectionDocument, RevokeApiTokenDocument } from '@taskflow/sdk';
import type { ApiTokenResponse } from '@taskflow/shared-types';
import { graphql } from '@/core/api/graphql-client';

/** Your browser extension (and later MCP) connections in a workspace. */
export const extensionApi = {
  list: async (workspaceId: string): Promise<ApiTokenResponse[]> => (await graphql(ApiTokensDocument, { workspaceId })).apiTokens as ApiTokenResponse[],
  approve: async (workspaceId: string, challenge: string, name: string): Promise<ApiTokenResponse> =>
    (await graphql(ApproveExtensionConnectionDocument, { workspaceId, challenge, name })).approveExtensionConnection as ApiTokenResponse,
  revoke: async (workspaceId: string, tokenId: string): Promise<boolean> => (await graphql(RevokeApiTokenDocument, { workspaceId, tokenId })).revokeApiToken,
};
