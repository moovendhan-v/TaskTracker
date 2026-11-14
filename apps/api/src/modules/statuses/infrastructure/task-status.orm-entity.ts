import { Column, Entity } from 'typeorm';
import type { StatusCategory } from '@taskflow/shared-types';
import { TenantOrmEntity } from '../../../core/database/base.orm-entity.js';
import type { TaskStatus } from '../domain/task-status.js';

@Entity({ name: 'task_status' })
export class TaskStatusOrmEntity extends TenantOrmEntity implements TaskStatus {
  @Column({ type: 'uuid' })
  spaceId: string;

  @Column({ type: 'varchar', length: 40 })
  name: string;

  @Column({ type: 'varchar', length: 9 })
  color: string;

  @Column({ type: 'varchar', length: 12 })
  category: StatusCategory;

  @Column({ type: 'integer' })
  position: number;

  @Column({ type: 'smallint', nullable: true })
  wipLimit: number | null;
}
