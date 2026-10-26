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
    return this.repository.find({ where: { workspaceId }, order: { createdAt: 'ASC' } });
  }

  findInWorkspace(workspaceId: string, listId: string): Promise<TaskList | null> {
    return this.repository.findOneBy({ id: listId, workspaceId });
  }

  firstInSpace(workspaceId: string, spaceId: string): Promise<TaskList | null> {
    return this.repository.findOne({ where: { workspaceId, spaceId }, order: { createdAt: 'ASC' } });
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
