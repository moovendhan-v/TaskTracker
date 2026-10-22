import { describe, expect, it } from 'vitest';
import type { Permission } from '@taskflow/shared-types';
import type { Comment } from './comment.js';
import { CommentOwnershipPolicy } from './comment-ownership.policy.js';

const comment = { authorId: 'author' } as Comment;

describe('CommentOwnershipPolicy', () => {
  it('lets only the author edit', () => {
    expect(() => CommentOwnershipPolicy.assertCanEdit(comment, 'author')).not.toThrow();
    expect(() => CommentOwnershipPolicy.assertCanEdit(comment, 'someone')).toThrow(/author/);
  });

  it('lets the author or a task manager delete', () => {
    expect(() => CommentOwnershipPolicy.assertCanDelete(comment, 'author', new Set())).not.toThrow();
    expect(() => CommentOwnershipPolicy.assertCanDelete(comment, 'x', new Set<Permission>(['task.delete']))).not.toThrow();
    expect(() => CommentOwnershipPolicy.assertCanDelete(comment, 'x', new Set<Permission>(['task.update']))).toThrow();
  });
});
