import { Column, Entity } from 'typeorm';
import { TenantOrmEntity } from '../../../core/database/base.orm-entity.js';
import type { TaskList } from '../domain/task-list.js';

@Entity({ name: 'task_list' })
export class TaskListOrmEntity extends TenantOrmEntity implements TaskList {
  @Column({ type: 'uuid' })
  spaceId: string;

  @Column({ type: 'varchar', length: 80 })
  name: string;
}
