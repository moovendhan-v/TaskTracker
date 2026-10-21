import { Column, Entity, Index } from 'typeorm';
import type { TaskPriority, TaskStatus } from '@taskflow/shared-types';
import { TenantEntity } from '../../database/base.entity.js';

@Entity({ name: 'task' })
@Index(['workspaceId', 'listId', 'status', 'position'])
export class TaskEntity extends TenantEntity {
  @Column({ type: 'uuid' })
  listId: string;

  @Column({ type: 'varchar', length: 200 })
  title: string;

  @Column({ type: 'text', default: '' })
  description: string;

  @Column({ type: 'varchar', length: 20 })
  status: TaskStatus;

  @Column({ type: 'varchar', length: 10 })
  priority: TaskPriority;

  @Column({ type: 'timestamptz', nullable: true })
  dueDate: Date | null;

  @Column({ type: 'text', nullable: true })
  assigneeId: string | null;

  @Column({ type: 'double precision' })
  position: number;

  @Column({ type: 'text' })
  createdById: string;
}
