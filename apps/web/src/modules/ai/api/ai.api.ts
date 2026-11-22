import {
  AiSettingsDocument,
  SummarizeChatDocument,
  SummarizeDocumentDocument,
  SummarizeTaskDocument,
  UpdateAiSettingsDocument,
} from '@taskflow/sdk';
import type { AiSettingsResponse, AiSummaryResponse, UpdateAiSettingsRequest } from '@taskflow/shared-types';
import { graphql } from '@/core/api/graphql-client';

/** What to summarise: a task, a doc page, or a chat channel (optionally one thread in it). */
export type SummaryTarget = { kind: 'task'; taskId: string } | { kind: 'document'; documentId: string } | { kind: 'chat'; channelId: string; threadRootId?: string | null };

export const aiApi = {
  settings: async (workspaceId: string): Promise<AiSettingsResponse> => (await graphql(AiSettingsDocument, { workspaceId })).aiSettings,
  updateSettings: async (workspaceId: string, input: UpdateAiSettingsRequest): Promise<AiSettingsResponse> => (await graphql(UpdateAiSettingsDocument, { workspaceId, input })).updateAiSettings,
  summarize: async (workspaceId: string, target: SummaryTarget): Promise<AiSummaryResponse> => {
    switch (target.kind) {
      case 'task':
        return (await graphql(SummarizeTaskDocument, { workspaceId, taskId: target.taskId })).summarizeTask;
      case 'document':
        return (await graphql(SummarizeDocumentDocument, { workspaceId, documentId: target.documentId })).summarizeDocument;
      case 'chat':
        return (await graphql(SummarizeChatDocument, { workspaceId, channelId: target.channelId, threadRootId: target.threadRootId ?? null })).summarizeChat;
    }
  },
};
