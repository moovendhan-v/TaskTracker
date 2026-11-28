import { ApiTokensDocument, ApproveExtensionConnectionDocument, CreateApiTokenDocument, RevokeApiTokenDocument } from '@taskflow/sdk';
import type { ApiTokenResponse } from '@taskflow/shared-types';
import { graphql } from '@/core/api/graphql-client';

/** Your browser extension (and later MCP) connections in a workspace. */
export const extensionApi = {
  list: async (workspaceId: string): Promise<ApiTokenResponse[]> => (await graphql(ApiTokensDocument, { workspaceId })).apiTokens as ApiTokenResponse[],
  approve: async (workspaceId: string, challenge: string, name: string): Promise<ApiTokenResponse> =>
    (await graphql(ApproveExtensionConnectionDocument, { workspaceId, challenge, name })).approveExtensionConnection as ApiTokenResponse,
  revoke: async (workspaceId: string, tokenId: string): Promise<boolean> => (await graphql(RevokeApiTokenDocument, { workspaceId, tokenId })).revokeApiToken,
  /** A token for an AI assistant (MCP / UTCP), shown once. */
  createAgentToken: async (workspaceId: string, name: string, write: boolean, days: number): Promise<{ token: string; apiToken: ApiTokenResponse }> => {
    const created = (await graphql(CreateApiTokenDocument, { workspaceId, name, client: 'mcp', scopes: write ? ['read', 'write'] : ['read'], days })).createApiToken;
    return { token: created.token, apiToken: created.apiToken as ApiTokenResponse };
  },
};
