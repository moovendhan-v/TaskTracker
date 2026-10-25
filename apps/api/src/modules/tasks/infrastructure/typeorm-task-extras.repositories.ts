import { Injectable } from '@nestjs/common';
import { TransactionalManager } from '../../../core/database/transactional-manager.js';
import type { NewTaskActivity, TaskActivity, TaskRelation } from '../domain/task-extras.js';
import { TaskActivityRepository, TaskRelationRepository, TaskWatcherRepository } from '../domain/task-extras.repository.js';
import { TaskActivityOrmEntity, TaskRelationOrmEntity, TaskWatcherOrmEntity } from './task-extras.orm-entities.js';

@Injectable()
export class TypeOrmTaskWatcherRepository extends TaskWatcherRepository {
  constructor(private readonly transactional: TransactionalManager) {
    super();
  }

  async list(workspaceId: string, taskId: string): Promise<string[]> {
    const rows = await this.transactional.repository(TaskWatcherOrmEntity).find({ where: { workspaceId, taskId }, order: { createdAt: 'ASC' } });
    return rows.map((row) => row.userId);
  }

  async add(workspaceId: string, taskId: string, userIds: readonly string[]): Promise<void> {
    if (userIds.length === 0) return;
    await this.transactional
      .repository(TaskWatcherOrmEntity)
      .createQueryBuilder()
      .insert()
      .values(userIds.map((userId) => ({ workspaceId, taskId, userId })))
      .orIgnore()
      .execute();
  }

  async remove(workspaceId: string, taskId: string, userId: string): Promise<void> {
    await this.transactional.repository(TaskWatcherOrmEntity).delete({ workspaceId, taskId, userId });
  }
}

@Injectable()
export class TypeOrmTaskRelationRepository extends TaskRelationRepository {
  constructor(private readonly transactional: TransactionalManager) {
    super();
  }

  private get repository() {
    return this.transactional.repository(TaskRelationOrmEntity);
  }

  listFor(workspaceId: string, taskId: string): Promise<TaskRelation[]> {
    return this.repository.find({ where: [{ workspaceId, taskId }, { workspaceId, relatedTaskId: taskId }], order: { createdAt: 'ASC' } });
  }

  findInWorkspace(workspaceId: string, relationId: string): Promise<TaskRelation | null> {
    return this.repository.findOneBy({ id: relationId, workspaceId });
  }

  async create(relation: Omit<TaskRelation, 'id' | 'createdAt'>): Promise<TaskRelation | null> {
    const exists = await this.repository.existsBy({ workspaceId: relation.workspaceId, taskId: relation.taskId, relatedTaskId: relation.relatedTaskId, kind: relation.kind });
    if (exists) return null;
    return this.repository.save(this.repository.create(relation));
  }

  async delete(workspaceId: string, relationId: string): Promise<void> {
    await this.repository.delete({ id: relationId, workspaceId });
  }
}

@Injectable()
export class TypeOrmTaskActivityRepository extends TaskActivityRepository {
  constructor(private readonly transactional: TransactionalManager) {
    super();
  }

  async record(entries: readonly NewTaskActivity[]): Promise<void> {
    if (entries.length === 0) return;
    await this.transactional.repository(TaskActivityOrmEntity).insert([...entries]);
  }

  async list(workspaceId: string, taskId: string, limit: number): Promise<TaskActivity[]> {
    const rows = await this.transactional
      .repository(TaskActivityOrmEntity)
      .createQueryBuilder('activity')
      .leftJoin('user', 'actor', 'actor.id = activity.actor_id')
      .addSelect('actor.name', 'actor_name')
      .where('activity.workspace_id = :workspaceId AND activity.task_id = :taskId', { workspaceId, taskId })
      .orderBy('activity.created_at', 'DESC')
      .limit(limit)
      .getRawAndEntities();
    return rows.entities.map((entity, index) => ({ ...entity, actorName: (rows.raw[index] as { actor_name: string | null }).actor_name ?? null }));
  }
}
