import { Column, Entity } from 'typeorm';
import type { LayoutItem } from '@taskflow/shared-types';
import { TenantOrmEntity } from '../../../core/database/base.orm-entity.js';

@Entity({ name: 'dashboard_layout' })
export class DashboardLayoutOrmEntity extends TenantOrmEntity {
  @Column({ type: 'text' })
  userId: string;

  @Column({ type: 'text' })
  pageKey: string;

  @Column({ type: 'jsonb' })
  items: LayoutItem[];

  @Column({ type: 'integer' })
  version: number;
}
