export const COMMENT_BODY_MAX = 5_000;

export interface CommentResponse {
  id: string;
  taskId: string;
  authorId: string;
  authorName: string;
  /** Plain text. Clients must render it as text, never as HTML. */
  body: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateCommentRequest {
  body: string;
}

export type UpdateCommentRequest = CreateCommentRequest;
