import { Column, Entity, PrimaryColumn } from 'typeorm';
import type { PlatformRole } from '@taskflow/shared-types';

/**
 * Read model over the `user` table that Better Auth owns. Better Auth creates and
 * migrates this table; TypeORM only reads it and updates the admin-managed fields.
 */
@Entity({ name: 'user', synchronize: false })
export class UserEntity {
  @PrimaryColumn({ type: 'text' })
  id: string;

  @Column({ type: 'text' })
  name: string;

  @Column({ type: 'text' })
  email: string;

  @Column({ type: 'text', nullable: true })
  image: string | null;

  @Column({ name: 'platformRole', type: 'text' })
  platformRole: PlatformRole;

  @Column({ name: 'suspended', type: 'boolean' })
  suspended: boolean;

  @Column({ name: 'createdAt', type: 'timestamptz' })
  createdAt: Date;
}
