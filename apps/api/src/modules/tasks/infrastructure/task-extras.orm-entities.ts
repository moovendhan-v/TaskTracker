import { Column, CreateDateColumn, Entity, PrimaryColumn, PrimaryGeneratedColumn } from 'typeorm';
import type { TaskRelationKind } from '@taskflow/shared-types';

@Entity({ name: 'task_watcher' })
export class TaskWatcherOrmEntity {
  @Column({ type: 'uuid' })
  workspaceId: string;

  @PrimaryColumn({ type: 'uuid' })
  taskId: string;

  @PrimaryColumn({ type: 'text' })
  userId: string;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;
}

@Entity({ name: 'task_relation' })
export class TaskRelationOrmEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  workspaceId: string;

  @Column({ type: 'uuid' })
  taskId: string;

  @Column({ type: 'uuid' })
  relatedTaskId: string;

  @Column({ type: 'varchar', length: 12 })
  kind: TaskRelationKind;

  @Column({ type: 'text', nullable: true })
  createdById: string | null;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;
}

@Entity({ name: 'task_activity' })
export class TaskActivityOrmEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  workspaceId: string;

  @Column({ type: 'uuid' })
  taskId: string;

  @Column({ type: 'text', nullable: true })
  actorId: string | null;

  @Column({ type: 'varchar', length: 30 })
  kind: string;

  @Column({ type: 'varchar', length: 40, nullable: true })
  field: string | null;

  @Column({ name: 'from_value', type: 'varchar', length: 300, nullable: true })
  fromValue: string | null;

  @Column({ name: 'to_value', type: 'varchar', length: 300, nullable: true })
  toValue: string | null;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;
}
