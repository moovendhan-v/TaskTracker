import { Injectable } from '@nestjs/common';
import { TransactionalManager } from '../../../core/database/transactional-manager.js';
import type { NewWorkspaceRole, WorkspaceRole } from '../domain/workspace-role.js';
import { WorkspaceRoleRepository } from '../domain/workspace-role.repository.js';
import { WorkspaceRoleOrmEntity } from './workspace-role.orm-entity.js';

@Injectable()
export class TypeOrmWorkspaceRoleRepository extends WorkspaceRoleRepository {
  constructor(private readonly transactional: TransactionalManager) {
    super();
  }

  private get repository() {
    return this.transactional.repository(WorkspaceRoleOrmEntity);
  }

  listByWorkspace(workspaceId: string): Promise<WorkspaceRole[]> {
    return this.repository.findBy({ workspaceId });
  }

  findInWorkspace(workspaceId: string, roleId: string): Promise<WorkspaceRole | null> {
    return this.repository.findOneBy({ id: roleId, workspaceId });
  }

  create(role: NewWorkspaceRole): Promise<WorkspaceRole> {
    return this.repository.save(this.repository.create(role));
  }

  createMany(roles: NewWorkspaceRole[]): Promise<WorkspaceRole[]> {
    return this.repository.save(roles.map((role) => this.repository.create(role)));
  }

  save(role: WorkspaceRole): Promise<WorkspaceRole> {
    return this.repository.save(this.repository.create(role));
  }

  async delete(workspaceId: string, roleId: string): Promise<void> {
    await this.repository.delete({ id: roleId, workspaceId });
  }

  isAssigned(workspaceId: string, roleId: string): Promise<boolean> {
    return this.transactional.manager
      .createQueryBuilder()
      .from('workspace_member', 'member')
      .where('member.workspace_id = :workspaceId AND member.role_id = :roleId', { workspaceId, roleId })
      .getExists();
  }
}
