import { Column, Entity, Unique } from 'typeorm';
import { TenantOrmEntity } from '../../../../core/database/base.orm-entity.js';
import type { Department } from '../domain/department.js';

@Entity({ name: 'department' })
@Unique(['workspaceId', 'name'])
export class DepartmentOrmEntity extends TenantOrmEntity implements Department {
  @Column({ type: 'varchar', length: 80 })
  name: string;

  @Column({ type: 'text', nullable: true })
  headUserId: string | null;
}
