import { Column, Entity, PrimaryColumn } from 'typeorm';
import type { PlatformRole } from '@taskflow/shared-types';
import type { User } from '../domain/user.js';

/**
 * Read model over the `user` table that Better Auth owns. Better Auth creates
 * and migrates the table; column names are its camelCase ones.
 */
@Entity({ name: 'user', synchronize: false })
export class UserOrmEntity implements User {
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
