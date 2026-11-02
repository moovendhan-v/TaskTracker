import { Injectable } from '@nestjs/common';
import type { DashboardLayout, LayoutItem, LayoutPage, LayoutVersion, WorkspaceLayout } from '@taskflow/shared-types';
import { TransactionalManager } from '../../../core/database/transactional-manager.js';
import { LayoutRepository, type LayoutKey } from '../domain/layout.repository.js';
import { DashboardLayoutOrmEntity } from './dashboard-layout.orm-entity.js';

interface Row {
  page_key: string;
  items: LayoutItem[];
  version: number;
  updated_at: Date;
}

const toLayout = (row: Pick<DashboardLayoutOrmEntity, 'pageKey' | 'items' | 'version' | 'updatedAt'>): DashboardLayout => ({
  pageKey: row.pageKey as LayoutPage,
  items: row.items,
  version: row.version,
  updatedAt: row.updatedAt.toISOString(),
});

/** Runs in the caller's workspace scope; row-level security also limits it to their own rows. */
@Injectable()
export class TypeOrmLayoutRepository extends LayoutRepository {
  constructor(private readonly transactional: TransactionalManager) {
    super();
  }

  async find({ workspaceId, userId, pageKey }: LayoutKey): Promise<DashboardLayout | null> {
    const row = await this.transactional.repository(DashboardLayoutOrmEntity).findOneBy({ workspaceId, userId, pageKey });
    return row ? toLayout(row) : null;
  }

  async saveIfVersion({ workspaceId, userId, pageKey }: LayoutKey, baseVersion: number | null, items: LayoutItem[]): Promise<DashboardLayout | null> {
    const json = JSON.stringify(items);
    // One statement each, so two saves racing can't both win.
    const rows: Row[] =
      baseVersion === null
        ? await this.transactional.manager.query(
            `INSERT INTO dashboard_layout (workspace_id, user_id, page_key, items)
             VALUES ($1, $2, $3, $4::jsonb)
             ON CONFLICT (workspace_id, user_id, page_key) DO NOTHING
             RETURNING page_key, items, version, updated_at`,
            [workspaceId, userId, pageKey, json],
          )
        : (
            await this.transactional.manager.query(
              `UPDATE dashboard_layout SET items = $4::jsonb, version = version + 1, updated_at = now()
               WHERE workspace_id = $1 AND user_id = $2 AND page_key = $3 AND version = $5
               RETURNING page_key, items, version, updated_at`,
              [workspaceId, userId, pageKey, json, baseVersion],
            )
          )[0];
    const row = rows[0];
    return row ? toLayout({ pageKey: row.page_key, items: row.items, version: row.version, updatedAt: new Date(row.updated_at) }) : null;
  }

  async remove({ workspaceId, userId, pageKey }: LayoutKey): Promise<void> {
    await this.transactional.repository(DashboardLayoutOrmEntity).delete({ workspaceId, userId, pageKey });
  }

  async addVersion({ workspaceId, userId, pageKey }: LayoutKey, version: number, items: LayoutItem[], keep: number): Promise<void> {
    await this.transactional.manager.query(
      `INSERT INTO dashboard_layout_version (workspace_id, user_id, page_key, version, items) VALUES ($1, $2, $3, $4, $5::jsonb)`,
      [workspaceId, userId, pageKey, version, JSON.stringify(items)],
    );
    await this.transactional.manager.query(
      `DELETE FROM dashboard_layout_version WHERE id IN (
         SELECT id FROM dashboard_layout_version WHERE workspace_id = $1 AND user_id = $2 AND page_key = $3
         ORDER BY saved_at DESC, version DESC OFFSET $4)`,
      [workspaceId, userId, pageKey, keep],
    );
  }

  async listVersions({ workspaceId, userId, pageKey }: LayoutKey, limit: number): Promise<LayoutVersion[]> {
    const rows: { version: number; items: LayoutItem[]; saved_at: Date }[] = await this.transactional.manager.query(
      `SELECT version, items, saved_at FROM dashboard_layout_version WHERE workspace_id = $1 AND user_id = $2 AND page_key = $3 ORDER BY saved_at DESC, version DESC LIMIT $4`,
      [workspaceId, userId, pageKey, limit],
    );
    return rows.map((row) => ({ version: row.version, items: row.items, savedAt: new Date(row.saved_at).toISOString() }));
  }

  async findDefault(workspaceId: string, pageKey: LayoutPage): Promise<WorkspaceLayout | null> {
    const [row]: DefaultRow[] = await this.transactional.manager.query(
      `SELECT d.page_key, d.items, d.updated_at, u.name AS updated_by_name FROM layout_default d LEFT JOIN "user" u ON u.id = d.updated_by
       WHERE d.workspace_id = $1 AND d.page_key = $2`,
      [workspaceId, pageKey],
    );
    return row ? toDefault(row) : null;
  }

  async saveDefault(workspaceId: string, pageKey: LayoutPage, items: LayoutItem[], userId: string): Promise<WorkspaceLayout> {
    await this.transactional.manager.query(
      `INSERT INTO layout_default (workspace_id, page_key, items, updated_by) VALUES ($1, $2, $3::jsonb, $4)
       ON CONFLICT (workspace_id, page_key) DO UPDATE SET items = EXCLUDED.items, updated_by = EXCLUDED.updated_by, updated_at = now()`,
      [workspaceId, pageKey, JSON.stringify(items), userId],
    );
    return (await this.findDefault(workspaceId, pageKey))!;
  }

  async removeDefault(workspaceId: string, pageKey: LayoutPage): Promise<boolean> {
    const result: unknown = await this.transactional.manager.query(`DELETE FROM layout_default WHERE workspace_id = $1 AND page_key = $2 RETURNING page_key`, [workspaceId, pageKey]);
    const rows = Array.isArray(result) && Array.isArray(result[0]) ? result[0] : (result as unknown[]);
    return rows.length > 0;
  }
}

interface DefaultRow {
  page_key: string;
  items: LayoutItem[];
  updated_at: Date;
  updated_by_name: string | null;
}

const toDefault = (row: DefaultRow): WorkspaceLayout => ({
  pageKey: row.page_key as LayoutPage,
  items: row.items,
  updatedAt: new Date(row.updated_at).toISOString(),
  updatedByName: row.updated_by_name,
});
