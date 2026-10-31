import { Injectable } from '@nestjs/common';
import type { DashboardLayout, LayoutItem, LayoutPage } from '@taskflow/shared-types';
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
}
