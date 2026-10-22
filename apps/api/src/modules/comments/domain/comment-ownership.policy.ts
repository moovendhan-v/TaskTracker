import type { Permission } from '@taskflow/shared-types';
import { DomainError } from '../../../core/domain/domain-error.js';
import type { Comment } from './comment.js';

/** Only the author edits a comment. The author, or anyone who can delete tasks, can remove it. */
export const CommentOwnershipPolicy = {
  assertCanEdit(comment: Comment, userId: string): void {
    if (comment.authorId !== userId) throw DomainError.forbidden('Only the author can edit this comment');
  },

  assertCanDelete(comment: Comment, userId: string, held: ReadonlySet<Permission>): void {
    if (comment.authorId !== userId && !held.has('task.delete')) {
      throw DomainError.forbidden('Only the author or a task manager can delete this comment');
    }
  },
};
