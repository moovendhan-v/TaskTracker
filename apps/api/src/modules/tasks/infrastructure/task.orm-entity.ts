import { Column, Entity, Index } from 'typeorm';
import type { TaskMetadata, TaskPriority, TaskStatus } from '@taskflow/shared-types';
import { TenantOrmEntity } from '../../../core/database/base.orm-entity.js';
import type { Task } from '../domain/task.js';

@Entity({ name: 'task' })
@Index(['workspaceId', 'listId', 'status', 'position'])
export class TaskOrmEntity extends TenantOrmEntity implements Task {
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

  @Column({ type: 'uuid', nullable: true })
  sprintId: string | null;

  @Column({ type: 'double precision' })
  position: number;

  @Column({ type: 'text' })
  createdById: string;

  @Column({ type: 'jsonb', default: () => `'{}'::jsonb` })
  metadata: TaskMetadata;
}
