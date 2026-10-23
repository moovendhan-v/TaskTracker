import type { CreateCommentRequest, UpdateCommentRequest } from '@taskflow/shared-types';
import { CommentsDocument, CreateCommentDocument, DeleteCommentDocument, UpdateCommentDocument } from '@taskflow/sdk';
import { graphql } from '@/core/api/graphql-client';

export const commentsApi = {
  list: async (workspaceId: string, taskId: string) => (await graphql(CommentsDocument, { workspaceId, taskId })).comments,
  create: async (workspaceId: string, taskId: string, input: CreateCommentRequest) =>
    (await graphql(CreateCommentDocument, { workspaceId, taskId, input })).createComment,
  update: async (workspaceId: string, commentId: string, input: UpdateCommentRequest) =>
    (await graphql(UpdateCommentDocument, { workspaceId, commentId, input })).updateComment,
  remove: async (workspaceId: string, commentId: string) =>
    (await graphql(DeleteCommentDocument, { workspaceId, commentId })).deleteComment,
};
