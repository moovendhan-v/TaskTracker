import { Injectable } from '@nestjs/common';
import type { SelectQueryBuilder } from 'typeorm';
import { TransactionalManager } from '../../../core/database/transactional-manager.js';
import type { SprintTaskRow } from '../domain/sprint-report.js';
import type { NewSprint, Sprint, SprintWithCounts } from '../domain/sprint.js';
import { SprintRepository } from '../domain/sprint.repository.js';
import { SprintOrmEntity } from './sprint.orm-entity.js';

interface CountsRow {
  sprint_id: string;
  total: string;
  done: string;
  points: string;
  done_points: string;
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
    return this.repository.save(this.repository.create({ ...sprint, status: 'planned', completedAt: null, committedTasks: null, committedPoints: null, startedAt: null }));
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
       WHERE workspace_id = $2 AND sprint_id = $3
         AND status_id NOT IN (SELECT id FROM task_status WHERE workspace_id = $2 AND category IN ('done', 'cancelled'))
       RETURNING id`,
      [toSprintId, workspaceId, fromSprintId],
    );
    return countReturnedRows(moved);
  }

  async moveTasks(workspaceId: string, fromSprintId: string, taskIds: readonly string[], toSprintId: string | null): Promise<number> {
    if (taskIds.length === 0) return 0;
    // Same guard as moveOpenTasks: only open tasks of the sprint being completed can move.
    const moved: unknown = await this.transactional.manager.query(
      `UPDATE task SET sprint_id = $1, updated_at = now()
       WHERE workspace_id = $2 AND sprint_id = $3 AND id = ANY($4::uuid[])
         AND status_id NOT IN (SELECT id FROM task_status WHERE workspace_id = $2 AND category IN ('done', 'cancelled'))
       RETURNING id`,
      [toSprintId, workspaceId, fromSprintId, [...taskIds]],
    );
    return countReturnedRows(moved);
  }

  async snapshot(workspaceId: string, sprintId: string, phase: 'start' | 'end'): Promise<void> {
    await this.transactional.manager.query(
      `INSERT INTO sprint_task_snapshot (workspace_id, space_id, sprint_id, task_id, phase, number, title, story_points, status_category)
       SELECT task.workspace_id, task.space_id, task.sprint_id, task.id, $3, task.number, left(task.title, 200), task.story_points, status.category
         FROM task JOIN task_status status ON status.id = task.status_id
        WHERE task.workspace_id = $1 AND task.sprint_id = $2
        ORDER BY task.number LIMIT ${SNAPSHOT_MAX}
       ON CONFLICT (sprint_id, phase, task_id) DO NOTHING`,
      [workspaceId, sprintId, phase],
    );
  }

  async noteDestinations(workspaceId: string, sprintId: string): Promise<void> {
    await this.transactional.manager.query(
      `UPDATE sprint_task_snapshot snap SET destination = COALESCE(task.sprint_id::text, 'backlog')
         FROM task
        WHERE snap.workspace_id = $1 AND snap.sprint_id = $2 AND snap.phase = 'end'
          AND task.id = snap.task_id AND task.workspace_id = $1 AND task.sprint_id IS DISTINCT FROM $2`,
      [workspaceId, sprintId],
    );
  }

  async snapshotRows(workspaceId: string, sprintId: string, phase: 'start' | 'end'): Promise<SprintTaskRow[]> {
    const rows: SnapshotRow[] = await this.transactional.manager.query(
      `SELECT task_id, number, title, story_points, status_category, destination FROM sprint_task_snapshot
        WHERE workspace_id = $1 AND sprint_id = $2 AND phase = $3 ORDER BY number LIMIT ${SNAPSHOT_MAX}`,
      [workspaceId, sprintId, phase],
    );
    return rows.map(toRow);
  }

  async currentRows(workspaceId: string, sprintId: string): Promise<SprintTaskRow[]> {
    const rows: SnapshotRow[] = await this.transactional.manager.query(
      `SELECT task.id AS task_id, task.number, task.title, task.story_points, status.category AS status_category, NULL AS destination
         FROM task JOIN task_status status ON status.id = task.status_id
        WHERE task.workspace_id = $1 AND task.sprint_id = $2 ORDER BY task.number LIMIT ${SNAPSHOT_MAX}`,
      [workspaceId, sprintId],
    );
    return rows.map(toRow);
  }

  private async withCounts(workspaceId: string, sprints: Sprint[]): Promise<SprintWithCounts[]> {
    if (sprints.length === 0) return [];
    const rows = await this.countsQuery(workspaceId, sprints.map((sprint) => sprint.id)).getRawMany<CountsRow>();
    const counts = new Map(rows.map((row) => [row.sprint_id, row]));
    return sprints.map((sprint) => ({
      ...sprint,
      totalTasks: Number(counts.get(sprint.id)?.total ?? 0),
      doneTasks: Number(counts.get(sprint.id)?.done ?? 0),
      totalPoints: Number(counts.get(sprint.id)?.points ?? 0),
      donePoints: Number(counts.get(sprint.id)?.done_points ?? 0),
    }));
  }

  private countsQuery(workspaceId: string, sprintIds: string[]): SelectQueryBuilder<object> {
    return this.transactional.manager
      .createQueryBuilder()
      .from('task', 'task')
      .select('task.sprint_id', 'sprint_id')
      .addSelect('COUNT(*)', 'total')
      .innerJoin('task_status', 'status', 'status.id = task.status_id')
      .addSelect(`COUNT(*) FILTER (WHERE status.category IN ('done', 'cancelled'))`, 'done')
      .addSelect('COALESCE(SUM(task.story_points), 0)', 'points')
      .addSelect(`COALESCE(SUM(task.story_points) FILTER (WHERE status.category = 'done'), 0)`, 'done_points')
      .where('task.workspace_id = :workspaceId AND task.sprint_id IN (:...sprintIds)', { workspaceId, sprintIds })
      .groupBy('task.sprint_id');
  }
}

/** Tasks one snapshot keeps at most. */
const SNAPSHOT_MAX = 2000;

interface SnapshotRow {
  task_id: string | null;
  number: number;
  title: string;
  story_points: number | null;
  status_category: string;
  destination: string | null;
}

const toRow = (row: SnapshotRow): SprintTaskRow => ({
  taskId: row.task_id,
  number: Number(row.number),
  title: row.title,
  points: row.story_points === null ? null : Number(row.story_points),
  statusCategory: row.status_category,
  destination: row.destination,
});

/** TypeORM's Postgres driver returns `[rows, rowCount]` for UPDATE ... RETURNING. */
function countReturnedRows(result: unknown): number {
  if (Array.isArray(result) && Array.isArray(result[0])) return result[0].length;
  return Array.isArray(result) ? result.length : 0;
}
