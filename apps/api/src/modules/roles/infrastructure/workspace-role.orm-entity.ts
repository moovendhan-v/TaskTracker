import { Column, Entity, Unique } from 'typeorm';
import type { Permission, SystemRoleKey } from '@taskflow/shared-types';
import { TenantOrmEntity } from '../../../core/database/base.orm-entity.js';
import type { WorkspaceRole } from '../domain/workspace-role.js';

@Entity({ name: 'workspace_role' })
@Unique(['workspaceId', 'name'])
export class WorkspaceRoleOrmEntity extends TenantOrmEntity implements WorkspaceRole {
  @Column({ type: 'varchar', length: 50 })
  name: string;

  @Column({ type: 'varchar', length: 20, nullable: true })
  systemKey: SystemRoleKey | null;

  @Column({ type: 'text', array: true, default: () => "'{}'" })
  permissions: Permission[];
}
