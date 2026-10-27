import { Injectable } from '@nestjs/common';
import { TransactionalManager } from '../../../core/database/transactional-manager.js';
import type { NewTaskList, TaskList } from '../domain/task-list.js';
import { TaskListRepository } from '../domain/task-list.repository.js';
import { TaskListOrmEntity } from './task-list.orm-entity.js';

@Injectable()
export class TypeOrmTaskListRepository extends TaskListRepository {
  constructor(private readonly transactional: TransactionalManager) {
    super();
  }

  private get repository() {
    return this.transactional.repository(TaskListOrmEntity);
  }

  listByWorkspace(workspaceId: string): Promise<TaskList[]> {
    return this.repository.find({ where: { workspaceId }, order: { position: 'ASC', createdAt: 'ASC' } });
  }

  findInWorkspace(workspaceId: string, listId: string): Promise<TaskList | null> {
    return this.repository.findOneBy({ id: listId, workspaceId });
  }

  firstInSpace(workspaceId: string, spaceId: string): Promise<TaskList | null> {
    return this.repository.findOne({ where: { workspaceId, spaceId }, order: { position: 'ASC', createdAt: 'ASC' } });
  }

  async maxPosition(workspaceId: string, spaceId: string, folderId: string | null): Promise<number> {
    const row = await this.repository
      .createQueryBuilder('list')
      .select('coalesce(max(list.position), 0)', 'max')
      .where('list.workspace_id = :workspaceId AND list.space_id = :spaceId', { workspaceId, spaceId })
      .andWhere(folderId ? 'list.folder_id = :folderId' : 'list.folder_id IS NULL', { folderId })
      .getRawOne<{ max: number }>();
    return Number(row?.max ?? 0);
  }

  async moveAllFromFolder(workspaceId: string, folderId: string, target: string | null): Promise<void> {
    await this.repository.update({ workspaceId, folderId }, { folderId: target });
  }

  create(list: NewTaskList): Promise<TaskList> {
    return this.repository.save(this.repository.create(list));
  }

  save(list: TaskList): Promise<TaskList> {
    return this.repository.save(this.repository.create(list));
  }

  async delete(workspaceId: string, listId: string): Promise<void> {
    await this.repository.delete({ id: listId, workspaceId });
  }
}
