import { Column, Entity, Unique } from 'typeorm';
import { TenantOrmEntity } from '../../../../core/database/base.orm-entity.js';
import type { LeaveType } from '../domain/leave-type.js';

@Entity({ name: 'leave_type' })
@Unique(['workspaceId', 'name'])
export class LeaveTypeOrmEntity extends TenantOrmEntity implements LeaveType {
  @Column({ type: 'varchar', length: 80 })
  name: string;

  @Column({ type: 'varchar', length: 7 })
  color: string;

  @Column({ type: 'integer', nullable: true })
  annualAllowanceDays: number | null;

  @Column({ type: 'boolean', default: true })
  requiresApproval: boolean;
}
