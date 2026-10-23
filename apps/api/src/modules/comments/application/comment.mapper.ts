import type { CommentResponse } from '@taskflow/shared-types';
import type { CommentWithAuthor } from '../domain/comment.js';

export const CommentMapper = {
  toResponse(comment: CommentWithAuthor): CommentResponse {
    return {
      id: comment.id,
      taskId: comment.taskId,
      authorId: comment.authorId,
      authorName: comment.authorName,
      body: comment.body,
      createdAt: comment.createdAt.toISOString(),
      updatedAt: comment.updatedAt.toISOString(),
    };
  },
};
