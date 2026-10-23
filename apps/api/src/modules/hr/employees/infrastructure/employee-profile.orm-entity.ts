import { Column, Entity, PrimaryColumn, UpdateDateColumn } from 'typeorm';
import type { EmploymentType } from '@taskflow/shared-types';
import type { EmployeeProfile } from '../domain/employee-profile.js';

@Entity({ name: 'employee_profile' })
export class EmployeeProfileOrmEntity implements EmployeeProfile {
  @PrimaryColumn({ type: 'uuid' })
  workspaceId: string;

  @PrimaryColumn({ type: 'text' })
  userId: string;

  @Column({ type: 'varchar', length: 100, nullable: true })
  jobTitle: string | null;

  @Column({ type: 'uuid', nullable: true })
  departmentId: string | null;

  @Column({ type: 'text', nullable: true })
  managerUserId: string | null;

  @Column({ type: 'varchar', length: 20, nullable: true })
  employmentType: EmploymentType | null;

  @Column({ type: 'date', nullable: true })
  startDate: string | null;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt: Date;
}
