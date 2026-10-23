import { Column, Entity } from 'typeorm';
import { TenantOrmEntity } from '../../../core/database/base.orm-entity.js';
import type { Space } from '../domain/space.js';

@Entity({ name: 'space' })
export class SpaceOrmEntity extends TenantOrmEntity implements Space {
  @Column({ type: 'varchar', length: 80 })
  name: string;

  @Column({ type: 'varchar', length: 7 })
  color: string;
}
