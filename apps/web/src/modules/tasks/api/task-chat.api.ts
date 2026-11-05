import { TaskChatMessagesDocument } from '@taskflow/sdk';
import { graphql } from '@/core/api/graphql-client';

/** Where a task came up in chat: messages the caller can read that mention it. */
export const taskChatApi = {
  about: async (workspaceId: string, taskId: string) => (await graphql(TaskChatMessagesDocument, { workspaceId, taskId })).taskChatMessages,
};
