import { Column, Entity, Index } from 'typeorm';
import type { SprintStatus } from '@taskflow/shared-types';
import { TenantOrmEntity } from '../../../core/database/base.orm-entity.js';
import type { Sprint } from '../domain/sprint.js';

@Entity({ name: 'sprint' })
@Index(['workspaceId', 'spaceId', 'startDate'])
export class SprintOrmEntity extends TenantOrmEntity implements Sprint {
  @Column({ type: 'uuid' })
  spaceId: string;

  @Column({ type: 'varchar', length: 80 })
  name: string;

  @Column({ type: 'varchar', length: 500, default: '' })
  goal: string;

  @Column({ type: 'date' })
  startDate: string;

  @Column({ type: 'date' })
  endDate: string;

  @Column({ type: 'varchar', length: 12, default: 'planned' })
  status: SprintStatus;

  @Column({ type: 'timestamptz', nullable: true })
  completedAt: Date | null;
}
