import { Injectable } from '@nestjs/common';
import { isChatRetentionDays, type ChatRetentionDays } from '@taskflow/shared-types';
import { TransactionalManager } from '../../../core/database/transactional-manager.js';
import { ChatRetentionRepository, type ExpiredThread } from '../domain/chat-retention.repository.js';

/** Bound parameters only. The sweep's reads and deletes run in the platform scope, always for one workspace. */
@Injectable()
export class TypeOrmChatRetentionRepository extends ChatRetentionRepository {
  constructor(private readonly transactional: TransactionalManager) {
    super();
  }

  private query<T>(sql: string, params: unknown[]): Promise<T[]> {
    return this.transactional.manager.query(sql, params);
  }

  async getDays(workspaceId: string): Promise<ChatRetentionDays | null> {
    const [row] = await this.query<{ days: number | null }>(`SELECT chat_retention_days AS days FROM workspace WHERE id = $1`, [workspaceId]);
    return isChatRetentionDays(row?.days) ? row.days : null;
  }

  async setDays(workspaceId: string, days: ChatRetentionDays | null): Promise<void> {
    await this.query(`UPDATE workspace SET chat_retention_days = $2 WHERE id = $1`, [workspaceId, days]);
  }

  async workspacesWithRetention(limit: number): Promise<{ workspaceId: string; days: ChatRetentionDays }[]> {
    const rows = await this.query<{ id: string; days: number }>(`SELECT id, chat_retention_days AS days FROM workspace WHERE chat_retention_days IS NOT NULL ORDER BY id LIMIT $1`, [limit]);
    return rows.filter((row) => isChatRetentionDays(row.days)).map((row) => ({ workspaceId: row.id, days: row.days as ChatRetentionDays }));
  }

  async expiredThreads(workspaceId: string, before: Date, limit: number): Promise<ExpiredThread[]> {
    const rows = await this.query<{ id: string; keys: string[] | null }>(
      `SELECT r.id,
              (SELECT array_agg(a.storage_key) FROM chat_attachment a JOIN chat_message m ON m.id = a.message_id
                WHERE a.workspace_id = $1 AND (m.id = r.id OR m.parent_id = r.id)) AS keys
       FROM chat_message r
       WHERE r.workspace_id = $1 AND r.parent_id IS NULL AND r.created_at < $2
         AND NOT EXISTS (SELECT 1 FROM chat_message c WHERE c.parent_id = r.id AND c.created_at >= $2)
       ORDER BY r.created_at LIMIT $3`,
      [workspaceId, before, limit],
    );
    return rows.map((row) => ({ rootId: row.id, storageKeys: row.keys ?? [] }));
  }

  async deleteThreads(workspaceId: string, rootIds: readonly string[]): Promise<number> {
    if (rootIds.length === 0) return 0;
    const result: unknown = await this.transactional.manager.query(`DELETE FROM chat_message WHERE workspace_id = $1 AND parent_id IS NULL AND id = ANY($2::uuid[]) RETURNING id`, [workspaceId, rootIds]);
    // DELETE … RETURNING comes back as [rows, count].
    const rows = Array.isArray(result) && Array.isArray(result[0]) ? (result[0] as unknown[]) : (result as unknown[]);
    return rows.length;
  }
}
