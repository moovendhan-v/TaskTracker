import { Injectable } from '@nestjs/common';
import { TransactionalManager } from '../../../core/database/transactional-manager.js';
import type { NewTaskStatus, TaskStatus } from '../domain/task-status.js';
import { TaskStatusRepository } from '../domain/task-status.repository.js';
import { TaskStatusOrmEntity } from './task-status.orm-entity.js';

@Injectable()
export class TypeOrmTaskStatusRepository extends TaskStatusRepository {
  constructor(private readonly transactional: TransactionalManager) {
    super();
  }

  private get repository() {
    return this.transactional.repository(TaskStatusOrmEntity);
  }

  listForSpace(workspaceId: string, spaceId: string): Promise<TaskStatus[]> {
    return this.repository.find({ where: { workspaceId, spaceId }, order: { position: 'ASC', createdAt: 'ASC' } });
  }

  listForWorkspace(workspaceId: string): Promise<TaskStatus[]> {
    return this.repository.find({ where: { workspaceId }, order: { spaceId: 'ASC', position: 'ASC' } });
  }

  findInWorkspace(workspaceId: string, statusId: string): Promise<TaskStatus | null> {
    return this.repository.findOneBy({ id: statusId, workspaceId });
  }

  createMany(statuses: NewTaskStatus[]): Promise<TaskStatus[]> {
    return this.repository.save(statuses.map((status) => this.repository.create(status)));
  }

  save(status: TaskStatus): Promise<TaskStatus> {
    return this.repository.save(this.repository.create(status));
  }

  async delete(workspaceId: string, statusId: string): Promise<void> {
    await this.repository.delete({ id: statusId, workspaceId });
  }

  async setPositions(workspaceId: string, orderedIds: readonly string[]): Promise<void> {
    // Sequential: one transaction connection. A handful of rows at most.
    for (const [index, id] of orderedIds.entries()) await this.repository.update({ id, workspaceId }, { position: index + 1 });
  }

  async moveTasks(workspaceId: string, fromStatusId: string, toStatusId: string): Promise<number> {
    // The task table is addressed by name so this module doesn't import the tasks entity; values are bound.
    const result: unknown = await this.transactional.manager.query(
      'UPDATE task SET status_id = $3, updated_at = now() WHERE workspace_id = $1 AND status_id = $2 RETURNING id',
      [workspaceId, fromStatusId, toStatusId],
    );
    const rows = Array.isArray(result) && Array.isArray(result[0]) ? result[0] : result;
    return Array.isArray(rows) ? rows.length : 0;
  }

}
