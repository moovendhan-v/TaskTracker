import { Injectable } from '@nestjs/common';
import { TransactionalManager } from '../../../core/database/transactional-manager.js';
import { TaskAttachmentRepository, type TaskAttachmentRecord } from '../domain/task-attachment.repository.js';

interface Row {
  id: string;
  task_id: string;
  uploader_id: string | null;
  uploader_name: string | null;
  file_name: string;
  content_type: string | null;
  declared_size: string;
  size: string | null;
  storage_key: string;
  status: 'pending' | 'ready';
  created_at: Date;
}

const SELECT = `
  SELECT a.id, a.task_id, a.uploader_id, u.name AS uploader_name, a.file_name, a.content_type, a.declared_size, a.size, a.storage_key, a.status, a.created_at
  FROM task_attachment a LEFT JOIN "user" u ON u.id = a.uploader_id`;

const toRecord = (row: Row): TaskAttachmentRecord => ({
  id: row.id,
  taskId: row.task_id,
  uploaderId: row.uploader_id,
  uploaderName: row.uploader_name,
  fileName: row.file_name,
  contentType: row.content_type,
  declaredSize: Number(row.declared_size),
  size: row.size === null ? null : Number(row.size),
  storageKey: row.storage_key,
  status: row.status,
  createdAt: new Date(row.created_at),
});

/** UPDATE/DELETE … RETURNING come back as [rows, count]; SELECT and INSERT as rows. */
const rowsOf = <T>(result: unknown): T[] => (Array.isArray(result) && Array.isArray(result[0]) ? (result[0] as T[]) : (result as T[]));

/** Bound parameters only; every statement also filters by workspace. */
@Injectable()
export class TypeOrmTaskAttachmentRepository extends TaskAttachmentRepository {
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

  async list(workspaceId: string, taskId: string): Promise<TaskAttachmentRecord[]> {
    return (await this.query<Row>(`${SELECT} WHERE a.workspace_id = $1 AND a.task_id = $2 AND a.status = 'ready' ORDER BY a.created_at, a.id LIMIT 200`, [workspaceId, taskId])).map(toRecord);
  }

  async find(workspaceId: string, id: string): Promise<TaskAttachmentRecord | null> {
    const [row] = await this.query<Row>(`${SELECT} WHERE a.workspace_id = $1 AND a.id = $2`, [workspaceId, id]);
    return row ? toRecord(row) : null;
  }

  async countOnTask(workspaceId: string, taskId: string): Promise<number> {
    const [row] = await this.query<{ count: string }>(`SELECT count(*) FROM task_attachment WHERE workspace_id = $1 AND task_id = $2`, [workspaceId, taskId]);
    return Number(row?.count ?? 0);
  }

  async countPending(workspaceId: string, uploaderId: string): Promise<number> {
    const [row] = await this.query<{ count: string }>(`SELECT count(*) FROM task_attachment WHERE workspace_id = $1 AND uploader_id = $2 AND status = 'pending'`, [workspaceId, uploaderId]);
    return Number(row?.count ?? 0);
  }

  async stale(workspaceId: string, uploaderId: string, before: Date): Promise<TaskAttachmentRecord[]> {
    return (await this.query<Row>(`${SELECT} WHERE a.workspace_id = $1 AND a.uploader_id = $2 AND a.status = 'pending' AND a.created_at < $3 LIMIT 50`, [workspaceId, uploaderId, before.toISOString()])).map(toRecord);
  }

  async insert(input: { workspaceId: string; taskId: string; uploaderId: string; fileName: string; declaredSize: number; storageKey: string }): Promise<string> {
    const [row] = await this.query<{ id: string }>(
      `INSERT INTO task_attachment (workspace_id, task_id, uploader_id, file_name, declared_size, storage_key) VALUES ($1, $2, $3, $4, $5, $6) RETURNING id`,
      [input.workspaceId, input.taskId, input.uploaderId, input.fileName, input.declaredSize, input.storageKey],
    );
    return row!.id;
  }

  async markReady(workspaceId: string, id: string, contentType: string, size: number): Promise<boolean> {
    const rows = await this.query(`UPDATE task_attachment SET status = 'ready', content_type = $3, size = $4 WHERE workspace_id = $1 AND id = $2 AND status = 'pending' RETURNING id`, [workspaceId, id, contentType, size]);
    return rows.length > 0;
  }

  async remove(workspaceId: string, id: string): Promise<boolean> {
    const rows = await this.query(`DELETE FROM task_attachment WHERE workspace_id = $1 AND id = $2 RETURNING id`, [workspaceId, id]);
    return rows.length > 0;
  }
}
