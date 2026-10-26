import { Column, Entity } from 'typeorm';
import type { CustomFieldValues, TaskMetadata, TaskPriority, TaskType } from '@taskflow/shared-types';
import { TenantOrmEntity } from '../../../core/database/base.orm-entity.js';
import type { Task } from '../domain/task.js';

@Entity({ name: 'task' })
export class TaskOrmEntity extends TenantOrmEntity implements Task {
  @Column({ type: 'integer' })
  number: number;

  @Column({ type: 'uuid' })
  listId: string;

  @Column({ type: 'uuid', nullable: true })
  parentId: string | null;

  @Column({ type: 'varchar', length: 12, default: 'task' })
  type: TaskType;

  @Column({ type: 'varchar', length: 200 })
  title: string;

  @Column({ type: 'text', default: '' })
  description: string;

  @Column({ type: 'uuid' })
  statusId: string;

  @Column({ type: 'varchar', length: 10 })
  priority: TaskPriority;

  @Column({ type: 'timestamptz', nullable: true })
  startDate: Date | null;

  @Column({ type: 'timestamptz', nullable: true })
  dueDate: Date | null;

  @Column({ type: 'text', nullable: true })
  assigneeId: string | null;

  @Column({ type: 'uuid', nullable: true })
  sprintId: string | null;

  @Column({ type: 'double precision' })
  position: number;

  @Column({ type: 'integer', nullable: true })
  estimateMinutes: number | null;

  @Column({ type: 'smallint', nullable: true })
  progress: number | null;

  @Column({ type: 'jsonb', default: () => `'{}'::jsonb` })
  metadata: TaskMetadata;

  @Column({ type: 'jsonb', default: () => `'{}'::jsonb` })
  customFields: CustomFieldValues;

  @Column({ type: 'timestamptz', nullable: true })
  completedAt: Date | null;

  @Column({ type: 'text' })
  createdById: string;
}
