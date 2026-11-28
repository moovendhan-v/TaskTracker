import { Column, Entity, Index } from 'typeorm';
import { TenantOrmEntity } from '../../../core/database/base.orm-entity.js';
import type { Comment } from '../domain/comment.js';

@Entity({ name: 'task_comment' })
@Index(['workspaceId', 'taskId', 'createdAt'])
export class CommentOrmEntity extends TenantOrmEntity implements Comment {
  @Column({ type: 'uuid' })
  taskId: string;

  @Column({ type: 'text' })
  authorId: string;

  @Column({ type: 'text' })
  body: string;

  /** The AI agent that wrote it (MCP), or null for a person. */
  @Column({ type: 'varchar', length: 80, nullable: true })
  agent: string | null;
}
