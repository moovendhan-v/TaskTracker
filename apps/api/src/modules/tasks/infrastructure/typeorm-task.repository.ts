import { Injectable } from '@nestjs/common';
import { TransactionalManager } from '../../../core/database/transactional-manager.js';
import type { PageRequest } from '../../../core/http/dto/page-query.dto.js';
import { escapeLike } from '../../../core/http/utils/escape-like.js';
import type { NewTask, Task, TaskFilter } from '../domain/task.js';
import { TaskRepository, type TaskPage } from '../domain/task.repository.js';
import { TaskOrmEntity } from './task.orm-entity.js';

@Injectable()
export class TypeOrmTaskRepository extends TaskRepository {
  constructor(private readonly transactional: TransactionalManager) {
    super();
  }

  private get repository() {
    return this.transactional.repository(TaskOrmEntity);
  }

  findInWorkspace(workspaceId: string, taskId: string): Promise<Task | null> {
    return this.repository.findOneBy({ id: taskId, workspaceId });
  }

  async pageInList(workspaceId: string, listId: string, filter: TaskFilter, page: PageRequest): Promise<TaskPage> {
    const query = this.repository
      .createQueryBuilder('task')
      .where('task.workspace_id = :workspaceId AND task.list_id = :listId', { workspaceId, listId });
    if (filter.status) query.andWhere('task.status = :status', { status: filter.status });
    if (filter.search) query.andWhere('task.title ILIKE :search', { search: `%${escapeLike(filter.search)}%` });

    const [items, total] = await query
      .orderBy('task.position', 'ASC')
      .addOrderBy('task.created_at', 'ASC')
      .skip((page.page - 1) * page.pageSize)
      .take(page.pageSize)
      .getManyAndCount();
    return { items, total };
  }

  async maxPosition(workspaceId: string, listId: string): Promise<number> {
    const row = await this.repository
      .createQueryBuilder('task')
      .select('MAX(task.position)', 'max')
      .where('task.workspace_id = :workspaceId AND task.list_id = :listId', { workspaceId, listId })
      .getRawOne<{ max: number | null }>();
    return Number(row?.max ?? 0);
  }

  create(task: NewTask): Promise<Task> {
    return this.repository.save(this.repository.create(task));
  }

  save(task: Task): Promise<Task> {
    return this.repository.save(this.repository.create(task));
  }

  async delete(workspaceId: string, taskId: string): Promise<void> {
    await this.repository.delete({ id: taskId, workspaceId });
  }
}
