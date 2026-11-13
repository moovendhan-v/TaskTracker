import { Injectable } from '@nestjs/common';
import { TransactionalManager } from '../../../core/database/transactional-manager.js';
import { ChecklistRepository, type ChecklistItemRecord } from '../domain/checklist.repository.js';

interface Row {
  id: string;
  task_id: string;
  title: string;
  done: boolean;
  done_at: Date | null;
  done_by_name: string | null;
  position: number;
  created_at: Date;
}

const SELECT = `SELECT c.id, c.task_id, c.title, c.done, c.done_at, u.name AS done_by_name, c.position, c.created_at
  FROM task_checklist_item c LEFT JOIN "user" u ON u.id = c.done_by`;

const rowsOf = <T>(result: unknown): T[] => (Array.isArray(result) && result.length === 2 && Array.isArray(result[0]) && typeof result[1] === 'number' ? (result[0] as T[]) : (result as T[]));

const toRecord = (row: Row): ChecklistItemRecord => ({
  id: row.id,
  taskId: row.task_id,
  title: row.title,
  done: row.done,
  doneAt: row.done_at ? new Date(row.done_at) : null,
  doneByName: row.done_by_name,
  position: Number(row.position),
  createdAt: new Date(row.created_at),
});

@Injectable()
export class TypeOrmChecklistRepository extends ChecklistRepository {
  constructor(private readonly transactional: TransactionalManager) {
    super();
  }

  private query<T>(sql: string, params: unknown[]): Promise<T[]> {
    return this.transactional.manager.query(sql, params).then((result: unknown) => rowsOf<T>(result));
  }

  async taskSpace(workspaceId: string, taskId: string): Promise<string | null> {
    const [row] = await this.query<{ space_id: string }>(`SELECT space_id FROM task WHERE workspace_id = $1 AND id = $2`, [workspaceId, taskId]);
    return row?.space_id ?? null;
  }

  async list(workspaceId: string, taskId: string): Promise<ChecklistItemRecord[]> {
    return (await this.query<Row>(`${SELECT} WHERE c.workspace_id = $1 AND c.task_id = $2 ORDER BY c.position, c.created_at LIMIT 200`, [workspaceId, taskId])).map(toRecord);
  }

  async find(workspaceId: string, id: string): Promise<ChecklistItemRecord | null> {
    const [row] = await this.query<Row>(`${SELECT} WHERE c.workspace_id = $1 AND c.id = $2`, [workspaceId, id]);
    return row ? toRecord(row) : null;
  }

  async count(workspaceId: string, taskId: string): Promise<number> {
    const [row] = await this.query<{ count: string }>(`SELECT count(*) FROM task_checklist_item WHERE workspace_id = $1 AND task_id = $2`, [workspaceId, taskId]);
    return Number(row?.count ?? 0);
  }

  async insert(input: { workspaceId: string; taskId: string; title: string; position: number; createdBy: string }): Promise<ChecklistItemRecord> {
    const [row] = await this.query<{ id: string }>(
      `INSERT INTO task_checklist_item (workspace_id, task_id, title, position, created_by) VALUES ($1, $2, $3, $4, $5) RETURNING id`,
      [input.workspaceId, input.taskId, input.title, input.position, input.createdBy],
    );
    return (await this.find(input.workspaceId, row!.id))!;
  }

  async update(workspaceId: string, id: string, changes: { title?: string; done?: { by: string } | false; position?: number }): Promise<ChecklistItemRecord | null> {
    const done = changes.done === undefined ? null : changes.done !== false;
    const doneBy = changes.done ? changes.done.by : null;
    const rows = await this.query<{ id: string }>(
      `UPDATE task_checklist_item SET
         title = COALESCE($3, title),
         position = COALESCE($4, position),
         done = COALESCE($5, done),
         done_at = CASE WHEN $5 IS NULL THEN done_at WHEN $5 THEN COALESCE(done_at, now()) ELSE NULL END,
         done_by = CASE WHEN $5 IS NULL THEN done_by WHEN $5 THEN COALESCE(done_by, $6) ELSE NULL END,
         updated_at = now()
       WHERE workspace_id = $1 AND id = $2 RETURNING id`,
      [workspaceId, id, changes.title ?? null, changes.position ?? null, done, doneBy],
    );
    return rows.length ? this.find(workspaceId, id) : null;
  }

  async delete(workspaceId: string, id: string): Promise<boolean> {
    return (await this.query<{ id: string }>(`DELETE FROM task_checklist_item WHERE workspace_id = $1 AND id = $2 RETURNING id`, [workspaceId, id])).length > 0;
  }
}
