export interface Comment {
  id: string;
  workspaceId: string;
  taskId: string;
  authorId: string;
  body: string;
  /** The AI agent that wrote it (MCP), or null for a person. */
  agent?: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export type NewComment = Pick<Comment, 'workspaceId' | 'taskId' | 'authorId' | 'body'>;

/** A comment joined with its author's display name. */
export interface CommentWithAuthor extends Comment {
  authorName: string;
}
