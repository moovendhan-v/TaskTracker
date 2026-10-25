import { Column, Entity } from 'typeorm';
import type { CustomFieldValues, SpaceStatus } from '@taskflow/shared-types';
import { TenantOrmEntity } from '../../../core/database/base.orm-entity.js';
import type { Space } from '../domain/space.js';

@Entity({ name: 'space' })
export class SpaceOrmEntity extends TenantOrmEntity implements Space {
  @Column({ type: 'varchar', length: 80 })
  name: string;

  @Column({ type: 'varchar', length: 7 })
  color: string;

  @Column({ type: 'varchar', length: 12, default: 'on_track' })
  status: SpaceStatus;

  @Column({ type: 'varchar', length: 500, default: '' })
  statusNote: string;

  @Column({ type: 'date', nullable: true })
  startDate: string | null;

  @Column({ type: 'date', nullable: true })
  dueDate: string | null;

  @Column({ type: 'jsonb', default: () => `'{}'::jsonb` })
  customFields: CustomFieldValues;
}
