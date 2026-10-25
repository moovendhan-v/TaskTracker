import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity({ name: 'role_policy' })
export class RolePolicyOrmEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  workspaceId: string;

  @Column({ type: 'uuid' })
  roleId: string;

  @Column({ type: 'varchar', length: 60, nullable: true })
  managedKey: string | null;

  @Column({ type: 'uuid', nullable: true })
  policyId: string | null;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;
}
