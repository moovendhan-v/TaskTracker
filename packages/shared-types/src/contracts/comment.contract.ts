export const COMMENT_BODY_MAX = 5_000;

export interface CommentResponse {
  id: string;
  taskId: string;
  authorId: string;
  authorName: string;
  /** Plain text. Clients must render it as text, never as HTML. */
  body: string;
  /** The AI agent (an MCP connection) that wrote it for the author, or null for the author themselves. */
  agent: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateCommentRequest {
  body: string;
}

export type UpdateCommentRequest = CreateCommentRequest;
