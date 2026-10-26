import { Column, Entity } from 'typeorm';
import type { PolicyDocument } from '@taskflow/shared-types';
import { TenantOrmEntity } from '../../../core/database/base.orm-entity.js';
import type { CustomPolicy } from '../domain/policy.js';

@Entity({ name: 'policy' })
export class PolicyOrmEntity extends TenantOrmEntity implements CustomPolicy {
  @Column({ type: 'varchar', length: 80 })
  name: string;

  @Column({ type: 'varchar', length: 300, default: '' })
  description: string;

  @Column({ type: 'jsonb' })
  document: PolicyDocument;

  @Column({ type: 'text', nullable: true })
  createdById: string | null;
}
