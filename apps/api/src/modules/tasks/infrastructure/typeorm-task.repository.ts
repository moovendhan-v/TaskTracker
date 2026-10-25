import { Injectable } from '@nestjs/common';
import { In } from 'typeorm';
import { TransactionalManager } from '../../../core/database/transactional-manager.js';
import { applyResourceQuery } from '../../../core/query/apply-resource-query.js';
import type { NormalizedQuery } from '../../../core/query/normalize-query.js';
import type { NewTask, Task } from '../domain/task.js';
import { TaskRepository, type TaskPage, type TaskSearchScope } from '../domain/task.repository.js';
import { TaskOrmEntity } from './task.orm-entity.js';
import { CLOSED_STATUS_SQL, PRIORITY_RANK_SQL } from './task.query-resource.js';

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

  findByNumber(workspaceId: string, number: number): Promise<Task | null> {
    return this.repository.findOneBy({ workspaceId, number });
  }

  findMany(workspaceId: string, taskIds: readonly string[]): Promise<Task[]> {
    if (taskIds.length === 0) return Promise.resolve([]);
    return this.repository.findBy({ workspaceId, id: In([...taskIds]) });
  }

  async search(workspaceId: string, scope: TaskSearchScope, query: NormalizedQuery): Promise<TaskPage> {
    const builder = this.repository.createQueryBuilder('task').where('task.workspace_id = :workspaceId', { workspaceId });
    if (scope.listId) builder.andWhere('task.list_id = :scopeListId', { scopeListId: scope.listId });
    if (scope.spaceId) {
      builder.innerJoin('task_list', 'scope_list', 'scope_list.id = task.list_id AND scope_list.workspace_id = task.workspace_id');
      builder.andWhere('scope_list.space_id = :scopeSpaceId', { scopeSpaceId: scope.spaceId });
    }
    const [items, total] = await applyResourceQuery(builder, query).getManyAndCount();
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

  listInSprint(workspaceId: string, sprintId: string, limit: number): Promise<Task[]> {
    return this.repository.find({ where: { workspaceId, sprintId }, order: { position: 'ASC', createdAt: 'ASC' }, take: limit });
  }

  backlogInSpace(workspaceId: string, spaceId: string, limit: number): Promise<Task[]> {
    return this.repository
      .createQueryBuilder('task')
      .innerJoin('task_list', 'list', 'list.id = task.list_id AND list.workspace_id = task.workspace_id')
      .where('task.workspace_id = :workspaceId AND list.space_id = :spaceId', { workspaceId, spaceId })
      .andWhere(`task.sprint_id IS NULL AND NOT ${CLOSED_STATUS_SQL}`)
      .addSelect(PRIORITY_RANK_SQL, 'priority_rank')
      .orderBy('priority_rank', 'ASC')
      .addOrderBy('task.created_at', 'ASC')
      .limit(limit)
      .getMany();
  }

  async nextNumber(workspaceId: string): Promise<number> {
    // The UPDATE locks the workspace row, so concurrent creates get consecutive, unique numbers.
    const result: unknown = await this.transactional.manager.query(
      'UPDATE workspace SET next_task_number = next_task_number + 1 WHERE id = $1 RETURNING next_task_number - 1 AS number',
      [workspaceId],
    );
    // TypeORM's Postgres driver returns [rows, rowCount] for UPDATE ... RETURNING.
    const rows = (Array.isArray(result) && Array.isArray(result[0]) ? result[0] : result) as { number: number }[];
    const [row] = rows;
    if (!row) throw new Error('Workspace not found while numbering a task');
    return Number(row.number);
  }

  async countSubtasks(workspaceId: string, taskIds: readonly string[]): Promise<Map<string, number>> {
    if (taskIds.length === 0) return new Map();
    const rows = await this.repository
      .createQueryBuilder('task')
      .select('task.parent_id', 'parent_id')
      .addSelect('COUNT(*)', 'count')
      .where('task.workspace_id = :workspaceId AND task.parent_id IN (:...taskIds)', { workspaceId, taskIds: [...taskIds] })
      .groupBy('task.parent_id')
      .getRawMany<{ parent_id: string; count: string }>();
    return new Map(rows.map((row) => [row.parent_id, Number(row.count)]));
  }

  listSubtasks(workspaceId: string, parentId: string, limit: number): Promise<Task[]> {
    return this.repository.find({ where: { workspaceId, parentId }, order: { position: 'ASC', createdAt: 'ASC' }, take: limit });
  }

  async depthOf(workspaceId: string, taskId: string): Promise<number> {
    const rows: { depth: number }[] = await this.transactional.manager.query(
      `WITH RECURSIVE chain AS (
         SELECT id, parent_id, 0 AS depth FROM task WHERE workspace_id = $1 AND id = $2
         UNION ALL
         SELECT t.id, t.parent_id, chain.depth + 1 FROM task t JOIN chain ON t.id = chain.parent_id
         WHERE t.workspace_id = $1 AND chain.depth < 10
       )
       SELECT max(depth) AS depth FROM chain`,
      [workspaceId, taskId],
    );
    return Number(rows[0]?.depth ?? 0);
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
