import { Column, Entity } from 'typeorm';
import { TenantEntity } from '../../database/base.entity.js';

@Entity({ name: 'space' })
export class SpaceEntity extends TenantEntity {
  @Column({ type: 'varchar', length: 80 })
  name: string;

  @Column({ type: 'varchar', length: 7 })
  color: string;
}
