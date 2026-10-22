import { Injectable } from '@nestjs/common';
import type { SelectQueryBuilder } from 'typeorm';
import { TransactionalManager } from '../../../core/database/transactional-manager.js';
import type { NewSprint, Sprint, SprintWithCounts } from '../domain/sprint.js';
import { SprintRepository } from '../domain/sprint.repository.js';
import { SprintOrmEntity } from './sprint.orm-entity.js';

interface CountsRow {
  sprint_id: string;
  total: string;
  done: string;
}

@Injectable()
export class TypeOrmSprintRepository extends SprintRepository {
  constructor(private readonly transactional: TransactionalManager) {
    super();
  }

  private get repository() {
    return this.transactional.repository(SprintOrmEntity);
  }

  async listInSpace(workspaceId: string, spaceId: string): Promise<SprintWithCounts[]> {
    const sprints = await this.repository.find({ where: { workspaceId, spaceId }, order: { startDate: 'DESC', createdAt: 'DESC' } });
    return this.withCounts(workspaceId, sprints);
  }

  async findInWorkspace(workspaceId: string, sprintId: string): Promise<SprintWithCounts | null> {
    const sprint = await this.repository.findOneBy({ id: sprintId, workspaceId });
    if (!sprint) return null;
    const [withCounts] = await this.withCounts(workspaceId, [sprint]);
    return withCounts ?? null;
  }

  hasActiveSprint(workspaceId: string, spaceId: string): Promise<boolean> {
    return this.repository.exists({ where: { workspaceId, spaceId, status: 'active' } });
  }

  create(sprint: NewSprint): Promise<Sprint> {
    return this.repository.save(this.repository.create({ ...sprint, status: 'planned', completedAt: null }));
  }

  save(sprint: Sprint): Promise<Sprint> {
    return this.repository.save(this.repository.create(sprint));
  }

  async delete(workspaceId: string, sprintId: string): Promise<void> {
    await this.repository.delete({ id: sprintId, workspaceId });
  }

  async moveOpenTasks(workspaceId: string, fromSprintId: string, toSprintId: string | null): Promise<number> {
    // Bound parameters only; the task table is addressed by name so this module doesn't import the tasks entity.
    const moved: unknown = await this.transactional.manager.query(
      `UPDATE task SET sprint_id = $1, updated_at = now()
       WHERE workspace_id = $2 AND sprint_id = $3 AND status <> 'done'
       RETURNING id`,
      [toSprintId, workspaceId, fromSprintId],
    );
    return countReturnedRows(moved);
  }

  private async withCounts(workspaceId: string, sprints: Sprint[]): Promise<SprintWithCounts[]> {
    if (sprints.length === 0) return [];
    const rows = await this.countsQuery(workspaceId, sprints.map((sprint) => sprint.id)).getRawMany<CountsRow>();
    const counts = new Map(rows.map((row) => [row.sprint_id, row]));
    return sprints.map((sprint) => ({
      ...sprint,
      totalTasks: Number(counts.get(sprint.id)?.total ?? 0),
      doneTasks: Number(counts.get(sprint.id)?.done ?? 0),
    }));
  }

  private countsQuery(workspaceId: string, sprintIds: string[]): SelectQueryBuilder<object> {
    return this.transactional.manager
      .createQueryBuilder()
      .from('task', 'task')
      .select('task.sprint_id', 'sprint_id')
      .addSelect('COUNT(*)', 'total')
      .addSelect(`COUNT(*) FILTER (WHERE task.status = 'done')`, 'done')
      .where('task.workspace_id = :workspaceId AND task.sprint_id IN (:...sprintIds)', { workspaceId, sprintIds })
      .groupBy('task.sprint_id');
  }
}

/** TypeORM's Postgres driver returns `[rows, rowCount]` for UPDATE ... RETURNING. */
function countReturnedRows(result: unknown): number {
  if (Array.isArray(result) && Array.isArray(result[0])) return result[0].length;
  return Array.isArray(result) ? result.length : 0;
}
