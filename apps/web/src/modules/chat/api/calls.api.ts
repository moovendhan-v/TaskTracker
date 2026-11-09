import { CallsOverviewDocument, JoinCallDocument } from '@taskflow/sdk';
import { graphql } from '@/core/api/graphql-client';

/** Calls in chat channels (D2). */
export const callsApi = {
  overview: async (workspaceId: string) => (await graphql(CallsOverviewDocument, { workspaceId })).callsOverview,
  join: async (workspaceId: string, channelId: string) => (await graphql(JoinCallDocument, { workspaceId, channelId })).joinCall,
};
