import { Column, Entity, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';
import type { GithubSyncSettings, PullRequestState } from '@taskflow/shared-types';
import { TenantOrmEntity } from '../../../core/database/base.orm-entity.js';
import type { GithubConnection, PullRequestLink } from '../domain/github.js';

@Entity({ name: 'github_connection' })
export class GithubConnectionOrmEntity extends TenantOrmEntity implements GithubConnection {
  @Column({ type: 'varchar', length: 201 })
  repo: string;

  @Column({ type: 'varchar', length: 10, default: 'TF' })
  taskPrefix: string;

  @Column({ type: 'jsonb', default: () => `'{}'::jsonb` })
  sync: GithubSyncSettings;

  @Column({ type: 'text', nullable: true })
  secretSealed: string | null;

  @Column({ type: 'uuid', nullable: true })
  installationRef: string | null;

  @Column({ type: 'timestamptz', nullable: true })
  pullsCursor: Date | null;

  @Column({ type: 'timestamptz', nullable: true })
  issuesCursor: Date | null;

  @Column({ type: 'timestamptz', nullable: true })
  polledAt: Date | null;

  @Column({ type: 'text', nullable: true })
  createdById: string | null;

  @Column({ type: 'timestamptz', nullable: true })
  lastDeliveryAt: Date | null;

  @Column({ type: 'varchar', length: 80, nullable: true })
  lastDeliveryStatus: string | null;
}

@Entity({ name: 'github_pull_request' })
export class PullRequestLinkOrmEntity implements PullRequestLink {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  workspaceId: string;

  @Column({ type: 'uuid' })
  connectionId: string;

  @Column({ type: 'uuid' })
  taskId: string;

  @Column({ type: 'varchar', length: 201 })
  repo: string;

  @Column({ type: 'integer' })
  number: number;

  @Column({ type: 'varchar', length: 300 })
  title: string;

  @Column({ type: 'varchar', length: 500 })
  url: string;

  @Column({ type: 'varchar', length: 10 })
  state: PullRequestState;

  @Column({ type: 'varchar', length: 100, default: '' })
  author: string;

  @Column({ type: 'varchar', length: 255, default: '' })
  branch: string;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt: Date;
}
