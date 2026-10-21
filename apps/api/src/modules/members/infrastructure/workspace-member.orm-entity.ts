import { Column, Entity, Unique } from 'typeorm';
import { TenantOrmEntity } from '../../../core/database/base.orm-entity.js';
import type { WorkspaceMember } from '../domain/workspace-member.js';

@Entity({ name: 'workspace_member' })
@Unique(['workspaceId', 'userId'])
export class WorkspaceMemberOrmEntity extends TenantOrmEntity implements WorkspaceMember {
  @Column({ type: 'text' })
  userId: string;

  @Column({ type: 'uuid' })
  roleId: string;
}
