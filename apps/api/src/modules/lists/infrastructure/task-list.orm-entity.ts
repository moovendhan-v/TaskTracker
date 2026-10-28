import { Column, Entity } from 'typeorm';
import type { IconKey } from '@taskflow/shared-types';
import { TenantOrmEntity } from '../../../core/database/base.orm-entity.js';
import type { TaskList } from '../domain/task-list.js';

@Entity({ name: 'task_list' })
export class TaskListOrmEntity extends TenantOrmEntity implements TaskList {
  @Column({ type: 'uuid' })
  spaceId: string;

  @Column({ type: 'uuid', nullable: true })
  folderId: string | null;

  @Column({ type: 'varchar', length: 80 })
  name: string;

  @Column({ type: 'varchar', length: 7, nullable: true })
  color: string | null;

  @Column({ type: 'varchar', length: 32, nullable: true })
  icon: IconKey | null;

  @Column({ type: 'double precision', default: 0 })
  position: number;
}
