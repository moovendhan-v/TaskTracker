import { Column, Entity, JoinColumn, ManyToOne, Unique } from 'typeorm';
import { TenantEntity } from '../database/base.entity.js';
import { WorkspaceRoleEntity } from '../roles/entities/workspace-role.entity.js';
import { UserEntity } from '../users/user.entity.js';

@Entity({ name: 'workspace_member' })
@Unique(['workspaceId', 'userId'])
export class WorkspaceMemberEntity extends TenantEntity {
  @Column({ type: 'text' })
  userId: string;

  @Column({ type: 'uuid' })
  roleId: string;

  @ManyToOne(() => WorkspaceRoleEntity, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'role_id' })
  role?: WorkspaceRoleEntity;

  @ManyToOne(() => UserEntity, { createForeignKeyConstraints: false })
  @JoinColumn({ name: 'user_id' })
  user?: UserEntity;
}
