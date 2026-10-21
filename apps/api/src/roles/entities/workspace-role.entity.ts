import { Column, Entity, Unique } from 'typeorm';
import type { Permission, SystemRoleKey } from '@taskflow/shared-types';
import { TenantEntity } from '../../database/base.entity.js';

@Entity({ name: 'workspace_role' })
@Unique(['workspaceId', 'name'])
export class WorkspaceRoleEntity extends TenantEntity {
  @Column({ type: 'varchar', length: 50 })
  name: string;

  /** Set for the built-in roles, which can't be renamed or deleted. */
  @Column({ type: 'varchar', length: 20, nullable: true })
  systemKey: SystemRoleKey | null;

  @Column({ type: 'text', array: true, default: () => "'{}'" })
  permissions: Permission[];
}
