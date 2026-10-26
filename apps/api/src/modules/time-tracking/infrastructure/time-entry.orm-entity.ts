import { Column, Entity } from 'typeorm';
import { TenantOrmEntity } from '../../../core/database/base.orm-entity.js';
import type { TimeEntry } from '../domain/time-entry.js';

@Entity({ name: 'time_entry' })
export class TimeEntryOrmEntity extends TenantOrmEntity implements TimeEntry {
  @Column({ type: 'text' })
  userId: string;

  @Column({ type: 'uuid', nullable: true })
  taskId: string | null;

  @Column({ type: 'uuid', nullable: true })
  spaceId: string | null;

  @Column({ type: 'timestamptz' })
  startedAt: Date;

  @Column({ type: 'timestamptz', nullable: true })
  endedAt: Date | null;

  @Column({ type: 'integer', default: 0 })
  minutes: number;

  @Column({ type: 'varchar', length: 1000, default: '' })
  note: string;

  @Column({ type: 'varchar', length: 40, default: '' })
  activity: string;
}
