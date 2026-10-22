import { Injectable } from '@nestjs/common';
import type { SelectQueryBuilder } from 'typeorm';
import { TransactionalManager } from '../../../core/database/transactional-manager.js';
import type { Comment, CommentWithAuthor, NewComment } from '../domain/comment.js';
import { CommentRepository } from '../domain/comment.repository.js';
import { CommentOrmEntity } from './comment.orm-entity.js';

interface CommentRow {
  id: string;
  workspace_id: string;
  task_id: string;
  author_id: string;
  author_name: string | null;
  body: string;
  created_at: Date;
  updated_at: Date;
}

@Injectable()
export class TypeOrmCommentRepository extends CommentRepository {
  constructor(private readonly transactional: TransactionalManager) {
    super();
  }

  private get repository() {
    return this.transactional.repository(CommentOrmEntity);
  }

  async listForTask(workspaceId: string, taskId: string, limit: number): Promise<CommentWithAuthor[]> {
    const rows = await this.withAuthor()
      .where('comment.workspace_id = :workspaceId AND comment.task_id = :taskId', { workspaceId, taskId })
      .orderBy('comment.created_at', 'ASC')
      .limit(limit)
      .getRawMany<CommentRow>();
    return rows.map(toComment);
  }

  async findInWorkspace(workspaceId: string, commentId: string): Promise<CommentWithAuthor | null> {
    const row = await this.withAuthor()
      .where('comment.workspace_id = :workspaceId AND comment.id = :commentId', { workspaceId, commentId })
      .getRawOne<CommentRow>();
    return row ? toComment(row) : null;
  }

  create(comment: NewComment): Promise<Comment> {
    return this.repository.save(this.repository.create(comment));
  }

  save(comment: Comment): Promise<Comment> {
    const { id, workspaceId, taskId, authorId, body, createdAt, updatedAt } = comment;
    return this.repository.save(this.repository.create({ id, workspaceId, taskId, authorId, body, createdAt, updatedAt }));
  }

  async delete(workspaceId: string, commentId: string): Promise<void> {
    await this.repository.delete({ id: commentId, workspaceId });
  }

  private withAuthor(): SelectQueryBuilder<CommentOrmEntity> {
    return this.repository
      .createQueryBuilder('comment')
      .leftJoin('user', 'author', 'author.id = comment.author_id')
      .select([
        'comment.id AS id',
        'comment.workspace_id AS workspace_id',
        'comment.task_id AS task_id',
        'comment.author_id AS author_id',
        'author.name AS author_name',
        'comment.body AS body',
        'comment.created_at AS created_at',
        'comment.updated_at AS updated_at',
      ]);
  }
}

function toComment(row: CommentRow): CommentWithAuthor {
  return {
    id: row.id,
    workspaceId: row.workspace_id,
    taskId: row.task_id,
    authorId: row.author_id,
    authorName: row.author_name ?? 'Former member',
    body: row.body,
    createdAt: new Date(row.created_at),
    updatedAt: new Date(row.updated_at),
  };
}
