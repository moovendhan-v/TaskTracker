import { Injectable } from '@nestjs/common';
import type { DashboardPeriod, DashboardTeam, DashboardVisibility, LayoutItem } from '@taskflow/shared-types';
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
  period: DashboardPeriod | null;
  department_id: string | null;
  department_name: string | null;
  updated_at: Date;
}

const COLUMNS =
  'id, workspace_id, owner_id, name, visibility, items, version, period, department_id, (SELECT d.name FROM department d WHERE d.workspace_id = dashboard.workspace_id AND d.id = dashboard.department_id) AS department_name, updated_at';
/** Who may read a dashboard ($1 workspace, $2 user): the same rule as the row-level security policy. */
const VISIBLE = `(owner_id = $2 OR visibility = 'workspace' OR (visibility = 'department' AND (
  EXISTS (SELECT 1 FROM department d WHERE d.workspace_id = $1 AND d.id = dashboard.department_id AND d.head_user_id = $2)
  OR EXISTS (SELECT 1 FROM employee_profile p WHERE p.workspace_id = $1 AND p.department_id = dashboard.department_id AND p.user_id = $2))))`;
const toRecord = (row: Row): DashboardRecord => ({
  id: row.id,
  workspaceId: row.workspace_id,
  ownerId: row.owner_id,
  name: row.name,
  visibility: row.visibility,
  items: row.items,
  version: row.version,
  period: row.period ?? null,
  departmentId: row.department_id ?? null,
  departmentName: row.department_name ?? null,
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
      `SELECT ${COLUMNS} FROM dashboard WHERE workspace_id = $1 AND ${VISIBLE} ORDER BY created_at, id LIMIT 200`,
      [workspaceId, userId],
    );
    return rows.map(toRecord);
  }

  async findVisible(workspaceId: string, userId: string, id: string): Promise<DashboardRecord | null> {
    const [row] = await this.query(`SELECT ${COLUMNS} FROM dashboard WHERE workspace_id = $1 AND id = $3 AND ${VISIBLE}`, [workspaceId, userId, id]);
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

  async rename(workspaceId: string, ownerId: string, id: string, changes: { name?: string; visibility?: DashboardVisibility; departmentId?: string | null; period?: DashboardPeriod }): Promise<DashboardRecord | null> {
    // A new visibility also sets the department: the one given for a team share, none otherwise.
    const [row] = await this.query(
      `UPDATE dashboard SET name = coalesce($4, name), visibility = coalesce($5, visibility),
         department_id = CASE WHEN $5::text IS NULL THEN department_id WHEN $5::text = 'department' THEN $7::uuid ELSE NULL END,
         period = coalesce($6, period), updated_at = now()
       WHERE workspace_id = $1 AND owner_id = $2 AND id = $3 RETURNING ${COLUMNS}`,
      [workspaceId, ownerId, id, changes.name ?? null, changes.visibility ?? null, changes.period ?? null, changes.departmentId ?? null],
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

  async teamsOf(workspaceId: string, userId: string): Promise<DashboardTeam[]> {
    return this.transactional.manager.query(
      `SELECT d.id, d.name FROM department d
       WHERE d.workspace_id = $1 AND (d.head_user_id = $2 OR EXISTS (SELECT 1 FROM employee_profile p WHERE p.workspace_id = $1 AND p.user_id = $2 AND p.department_id = d.id))
       ORDER BY d.name LIMIT 50`,
      [workspaceId, userId],
    );
  }

  async remove(workspaceId: string, ownerId: string, id: string): Promise<boolean> {
    const rows = await this.query(`DELETE FROM dashboard WHERE workspace_id = $1 AND owner_id = $2 AND id = $3 RETURNING ${COLUMNS}`, [workspaceId, ownerId, id]);
    return rows.length > 0;
  }
}
