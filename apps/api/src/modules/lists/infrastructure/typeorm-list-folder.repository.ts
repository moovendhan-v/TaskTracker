import { Injectable } from '@nestjs/common';
import { TransactionalManager } from '../../../core/database/transactional-manager.js';
import type { ListFolder, NewListFolder } from '../domain/list-folder.js';
import { ListFolderRepository } from '../domain/list-folder.repository.js';
import { ListFolderOrmEntity } from './list-folder.orm-entity.js';

@Injectable()
export class TypeOrmListFolderRepository extends ListFolderRepository {
  constructor(private readonly transactional: TransactionalManager) {
    super();
  }

  private get repository() {
    return this.transactional.repository(ListFolderOrmEntity);
  }

  listByWorkspace(workspaceId: string): Promise<ListFolder[]> {
    return this.repository.find({ where: { workspaceId }, order: { position: 'ASC', createdAt: 'ASC' } });
  }

  listBySpace(workspaceId: string, spaceId: string): Promise<ListFolder[]> {
    return this.repository.find({ where: { workspaceId, spaceId }, order: { position: 'ASC', createdAt: 'ASC' } });
  }

  findInWorkspace(workspaceId: string, folderId: string): Promise<ListFolder | null> {
    return this.repository.findOneBy({ id: folderId, workspaceId });
  }

  create(folder: NewListFolder): Promise<ListFolder> {
    return this.repository.save(this.repository.create(folder));
  }

  save(folder: ListFolder): Promise<ListFolder> {
    return this.repository.save(this.repository.create(folder));
  }

  async delete(workspaceId: string, folderId: string): Promise<void> {
    await this.repository.delete({ id: folderId, workspaceId });
  }
}
