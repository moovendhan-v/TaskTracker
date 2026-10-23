import { Injectable } from '@nestjs/common';
import { In } from 'typeorm';
import { TransactionalManager } from '../../../core/database/transactional-manager.js';
import type { NewWorkspace, Workspace } from '../domain/workspace.js';
import { WorkspaceRepository } from '../domain/workspace.repository.js';
import { WorkspaceOrmEntity } from './workspace.orm-entity.js';

@Injectable()
export class TypeOrmWorkspaceRepository extends WorkspaceRepository {
  constructor(private readonly transactional: TransactionalManager) {
    super();
  }

  private get repository() {
    return this.transactional.repository(WorkspaceOrmEntity);
  }

  findById(id: string): Promise<Workspace | null> {
    return this.repository.findOneBy({ id });
  }

  async findByIds(ids: readonly string[]): Promise<Workspace[]> {
    if (ids.length === 0) return [];
    return this.repository.findBy({ id: In([...ids]) });
  }

  create(workspace: NewWorkspace): Promise<Workspace> {
    return this.repository.save(this.repository.create(workspace));
  }

  save(workspace: Workspace): Promise<Workspace> {
    return this.repository.save(this.repository.create(workspace));
  }

  async delete(id: string): Promise<void> {
    await this.repository.delete({ id });
  }
}
