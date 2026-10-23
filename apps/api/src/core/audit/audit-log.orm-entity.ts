import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

/** Append-only. A database trigger rejects UPDATE and DELETE on this table. */
@Entity({ name: 'audit_log' })
@Index(['workspaceId', 'createdAt'])
export class AuditLogOrmEntity {
  @PrimaryGeneratedColumn('increment', { type: 'bigint' })
  id: string;

  @Column({ type: 'text' })
  actorId: string;

  @Column({ type: 'varchar', length: 80 })
  action: string;

  @Column({ type: 'varchar', length: 40 })
  targetType: string;

  @Column({ type: 'text', nullable: true })
  targetId: string | null;

  @Column({ type: 'uuid', nullable: true })
  workspaceId: string | null;

  @Column({ type: 'varchar', length: 64, nullable: true })
  ip: string | null;

  @Column({ type: 'jsonb', default: () => "'{}'" })
  metadata: Record<string, unknown>;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;
}
