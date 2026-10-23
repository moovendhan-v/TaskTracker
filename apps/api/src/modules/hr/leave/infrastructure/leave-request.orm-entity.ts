import { Column, Entity, Index } from 'typeorm';
import type { LeaveStatus } from '@taskflow/shared-types';
import { TenantOrmEntity } from '../../../../core/database/base.orm-entity.js';
import type { LeaveRequest } from '../domain/leave-request.js';

@Entity({ name: 'leave_request' })
@Index(['workspaceId', 'userId', 'startDate'])
@Index(['workspaceId', 'status', 'createdAt'])
export class LeaveRequestOrmEntity extends TenantOrmEntity implements LeaveRequest {
  @Column({ type: 'text' })
  userId: string;

  @Column({ type: 'uuid' })
  leaveTypeId: string;

  @Column({ type: 'date' })
  startDate: string;

  @Column({ type: 'date' })
  endDate: string;

  @Column({ type: 'integer' })
  days: number;

  @Column({ type: 'varchar', length: 1000, default: '' })
  reason: string;

  @Column({ type: 'varchar', length: 12 })
  status: LeaveStatus;

  @Column({ type: 'text', nullable: true })
  decidedById: string | null;

  @Column({ type: 'timestamptz', nullable: true })
  decidedAt: Date | null;

  @Column({ type: 'varchar', length: 1000, default: '' })
  decisionNote: string;
}
