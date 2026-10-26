import { Injectable } from '@nestjs/common';
import { TransactionalManager } from '../../../core/database/transactional-manager.js';
import type { NewTimeEntry, TimeEntry, TimeEntryFilter, TimeEntryView } from '../domain/time-entry.js';
import { TimeEntryRepository } from '../domain/time-entry.repository.js';
import { TimeEntryOrmEntity } from './time-entry.orm-entity.js';

interface ViewRow {
  id: string;
  workspace_id: string;
  user_id: string;
  task_id: string | null;
  space_id: string | null;
  started_at: Date;
  ended_at: Date | null;
  minutes: number;
  note: string;
  activity: string;
  created_at: Date;
  updated_at: Date;
  user_name: string | null;
  task_number: number | null;
  task_title: string | null;
  space_name: string | null;
}

const VIEW_SQL = `
  SELECT e.*, u.name AS user_name, t.number AS task_number, t.title AS task_title, s.name AS space_name
  FROM time_entry e
  LEFT JOIN "user" u ON u.id = e.user_id
  LEFT JOIN task t ON t.id = e.task_id AND t.workspace_id = e.workspace_id
  LEFT JOIN space s ON s.id = e.space_id AND s.workspace_id = e.workspace_id`;

@Injectable()
export class TypeOrmTimeEntryRepository extends TimeEntryRepository {
  constructor(private readonly transactional: TransactionalManager) {
    super();
  }

  private get repository() {
    return this.transactional.repository(TimeEntryOrmEntity);
  }

  findInWorkspace(workspaceId: string, entryId: string): Promise<TimeEntry | null> {
    return this.repository.findOneBy({ id: entryId, workspaceId });
  }

  async findView(workspaceId: string, entryId: string): Promise<TimeEntryView | null> {
    const rows: ViewRow[] = await this.transactional.manager.query(`${VIEW_SQL} WHERE e.workspace_id = $1 AND e.id = $2`, [workspaceId, entryId]);
    return rows[0] ? toView(rows[0]) : null;
  }

  running(workspaceId: string, userId: string): Promise<TimeEntry | null> {
    return this.repository.createQueryBuilder('entry').where('entry.workspace_id = :workspaceId AND entry.user_id = :userId AND entry.ended_at IS NULL', { workspaceId, userId }).getOne();
  }

  async list(workspaceId: string, filter: TimeEntryFilter): Promise<TimeEntryView[]> {
    // Only fixed SQL fragments are joined; every value is a bound parameter.
    const params: unknown[] = [workspaceId, filter.from, filter.to];
    const where = ['e.workspace_id = $1', 'e.started_at >= $2', 'e.started_at < $3'];
    if (filter.userIds) {
      params.push(filter.userIds);
      where.push(`e.user_id = ANY($${params.length}::text[])`);
    }
    if (filter.spaceId) {
      params.push(filter.spaceId);
      where.push(`e.space_id = $${params.length}`);
    }
    if (filter.taskId) {
      params.push(filter.taskId);
      where.push(`e.task_id = $${params.length}`);
    }
    params.push(filter.limit);
    const rows: ViewRow[] = await this.transactional.manager.query(`${VIEW_SQL} WHERE ${where.join(' AND ')} ORDER BY e.started_at ASC, e.id ASC LIMIT $${params.length}`, params);
    return rows.map(toView);
  }

  create(entry: NewTimeEntry): Promise<TimeEntry> {
    return this.repository.save(this.repository.create(entry));
  }

  save(entry: TimeEntry): Promise<TimeEntry> {
    return this.repository.save(this.repository.create(entry));
  }

  async delete(workspaceId: string, entryId: string): Promise<void> {
    await this.repository.delete({ id: entryId, workspaceId });
  }

  async totalsForTask(workspaceId: string, taskId: string, userId: string): Promise<{ total: number; mine: number; count: number }> {
    const [row]: { total: string | null; mine: string | null; count: string }[] = await this.transactional.manager.query(
      `SELECT SUM(minutes) AS total, SUM(minutes) FILTER (WHERE user_id = $3) AS mine, COUNT(*) AS count
       FROM time_entry WHERE workspace_id = $1 AND task_id = $2 AND ended_at IS NOT NULL`,
      [workspaceId, taskId, userId],
    );
    return { total: Number(row?.total ?? 0), mine: Number(row?.mine ?? 0), count: Number(row?.count ?? 0) };
  }
}

function toView(row: ViewRow): TimeEntryView {
  return {
    id: row.id,
    workspaceId: row.workspace_id,
    userId: row.user_id,
    taskId: row.task_id,
    spaceId: row.space_id,
    startedAt: row.started_at,
    endedAt: row.ended_at,
    minutes: row.minutes,
    note: row.note,
    activity: row.activity,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    userName: row.user_name,
    taskNumber: row.task_number,
    taskTitle: row.task_title,
    spaceName: row.space_name,
  };
}
