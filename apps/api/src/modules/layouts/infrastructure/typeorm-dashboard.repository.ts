import { Injectable } from '@nestjs/common';
import type { DashboardVisibility, LayoutItem } from '@taskflow/shared-types';
import { TransactionalManager } from '../../../core/database/transactional-manager.js';
import { DashboardRepository, type DashboardRecord } from '../domain/dashboard.repository.js';

interface Row {
  id: string;
  workspace_id: string;
  owner_id: string;
  name: string;
  visibility: DashboardVisibility;
  items: LayoutItem[];
  version: number;
  updated_at: Date;
}

const COLUMNS = 'id, workspace_id, owner_id, name, visibility, items, version, updated_at';
const toRecord = (row: Row): DashboardRecord => ({
  id: row.id,
  workspaceId: row.workspace_id,
  ownerId: row.owner_id,
  name: row.name,
  visibility: row.visibility,
  items: row.items,
  version: row.version,
  updatedAt: new Date(row.updated_at),
});
/** UPDATE/DELETE … RETURNING come back as [rows, count]; SELECT and INSERT as rows. */
const rowsOf = (result: unknown): Row[] => (Array.isArray(result) && Array.isArray(result[0]) ? (result[0] as Row[]) : (result as Row[]));

/**
 * Bound parameters only. Every statement repeats the visibility / ownership rule
 * that row-level security also enforces, so the two have to agree to return rows.
 */
@Injectable()
export class TypeOrmDashboardRepository extends DashboardRepository {
  constructor(private readonly transactional: TransactionalManager) {
    super();
  }

  private query(sql: string, params: unknown[]): Promise<Row[]> {
    return this.transactional.manager.query(sql, params).then(rowsOf);
  }

  async listVisible(workspaceId: string, userId: string): Promise<DashboardRecord[]> {
    const rows = await this.query(
      `SELECT ${COLUMNS} FROM dashboard WHERE workspace_id = $1 AND (owner_id = $2 OR visibility = 'workspace') ORDER BY created_at, id LIMIT 200`,
      [workspaceId, userId],
    );
    return rows.map(toRecord);
  }

  async findVisible(workspaceId: string, userId: string, id: string): Promise<DashboardRecord | null> {
    const [row] = await this.query(`SELECT ${COLUMNS} FROM dashboard WHERE workspace_id = $1 AND id = $3 AND (owner_id = $2 OR visibility = 'workspace')`, [workspaceId, userId, id]);
    return row ? toRecord(row) : null;
  }

  async countOwned(workspaceId: string, ownerId: string): Promise<number> {
    const rows: { count: string }[] = await this.transactional.manager.query(`SELECT count(*) FROM dashboard WHERE workspace_id = $1 AND owner_id = $2`, [workspaceId, ownerId]);
    return Number(rows[0]?.count ?? 0);
  }

  async create(record: Pick<DashboardRecord, 'workspaceId' | 'ownerId' | 'name' | 'visibility' | 'items'>): Promise<DashboardRecord> {
    const [row] = await this.query(
      `INSERT INTO dashboard (workspace_id, owner_id, name, visibility, items) VALUES ($1, $2, $3, $4, $5::jsonb) RETURNING ${COLUMNS}`,
      [record.workspaceId, record.ownerId, record.name, record.visibility, JSON.stringify(record.items)],
    );
    return toRecord(row!);
  }

  async rename(workspaceId: string, ownerId: string, id: string, changes: { name?: string; visibility?: DashboardVisibility }): Promise<DashboardRecord | null> {
    const [row] = await this.query(
      `UPDATE dashboard SET name = coalesce($4, name), visibility = coalesce($5, visibility), updated_at = now()
       WHERE workspace_id = $1 AND owner_id = $2 AND id = $3 RETURNING ${COLUMNS}`,
      [workspaceId, ownerId, id, changes.name ?? null, changes.visibility ?? null],
    );
    return row ? toRecord(row) : null;
  }

  async saveItemsIfVersion(workspaceId: string, ownerId: string, id: string, baseVersion: number, items: LayoutItem[]): Promise<DashboardRecord | null> {
    const [row] = await this.query(
      `UPDATE dashboard SET items = $5::jsonb, version = version + 1, updated_at = now()
       WHERE workspace_id = $1 AND owner_id = $2 AND id = $3 AND version = $4 RETURNING ${COLUMNS}`,
      [workspaceId, ownerId, id, baseVersion, JSON.stringify(items)],
    );
    return row ? toRecord(row) : null;
  }

  async remove(workspaceId: string, ownerId: string, id: string): Promise<boolean> {
    const rows = await this.query(`DELETE FROM dashboard WHERE workspace_id = $1 AND owner_id = $2 AND id = $3 RETURNING ${COLUMNS}`, [workspaceId, ownerId, id]);
    return rows.length > 0;
  }
}
