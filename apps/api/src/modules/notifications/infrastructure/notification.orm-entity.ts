import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn } from 'typeorm';
import type { Notification, NotificationKind } from '../domain/notification.js';

@Entity({ name: 'notification' })
export class NotificationOrmEntity implements Notification {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  workspaceId: string;

  @Column({ type: 'text' })
  recipientId: string;

  @Column({ type: 'text', nullable: true })
  actorId: string | null;

  @Column({ type: 'varchar', length: 30 })
  kind: NotificationKind;

  @Column({ type: 'varchar', length: 30 })
  entityType: string;

  @Column({ type: 'varchar', length: 64 })
  entityId: string;

  @Column({ type: 'uuid', nullable: true })
  taskId: string | null;

  @Column({ type: 'varchar', length: 300 })
  subject: string;

  @Column({ type: 'varchar', length: 300, default: '' })
  excerpt: string;

  @Column({ type: 'timestamptz', nullable: true })
  readAt: Date | null;

  @Column({ type: 'timestamptz', nullable: true })
  snoozedUntil: Date | null;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;
}
