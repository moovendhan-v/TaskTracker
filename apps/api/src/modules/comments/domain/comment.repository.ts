import type { Comment, CommentWithAuthor, NewComment } from './comment.js';

export abstract class CommentRepository {
  /** Oldest first, capped at `limit`. */
  abstract listForTask(workspaceId: string, taskId: string, limit: number): Promise<CommentWithAuthor[]>;
  abstract findInWorkspace(workspaceId: string, commentId: string): Promise<CommentWithAuthor | null>;
  abstract create(comment: NewComment): Promise<Comment>;
  abstract save(comment: Comment): Promise<Comment>;
  abstract delete(workspaceId: string, commentId: string): Promise<void>;
  /** Names of these workspace members (others are left out), for mention previews. */
  abstract memberNames(workspaceId: string, userIds: readonly string[]): Promise<Map<string, string>>;
}
