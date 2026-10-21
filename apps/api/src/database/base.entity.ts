import { Column, CreateDateColumn, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';

export abstract class BaseEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt: Date;
}

/** Base for rows that belong to a workspace. Every query on these must filter by workspaceId. */
export abstract class TenantEntity extends BaseEntity {
  @Column({ type: 'uuid' })
  workspaceId: string;
}
