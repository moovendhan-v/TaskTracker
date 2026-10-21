import { Column, Entity } from 'typeorm';
import { TenantEntity } from '../../database/base.entity.js';

@Entity({ name: 'task_list' })
export class TaskListEntity extends TenantEntity {
  @Column({ type: 'uuid' })
  spaceId: string;

  @Column({ type: 'varchar', length: 80 })
  name: string;
}
