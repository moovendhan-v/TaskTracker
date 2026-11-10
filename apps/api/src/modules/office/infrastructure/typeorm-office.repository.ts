import { Injectable } from '@nestjs/common';
import { isOfficeChosenStatus } from '@taskflow/shared-types';
import { TransactionalManager } from '../../../core/database/transactional-manager.js';
import { OfficeRepository, type OfficePresenceRecord } from '../domain/office.repository.js';

interface Row {
  user_id: string;
  name: string;
  x: number;
  y: number;
  status: string;
  last_seen_at: Date;
  in_call: boolean;
}

const SELECT = `SELECT p.user_id, u.name, p.x, p.y, p.status, p.last_seen_at,
  EXISTS (SELECT 1 FROM call_participant c JOIN call_session s ON s.id = c.session_id
          WHERE c.workspace_id = p.workspace_id AND c.user_id = p.user_id AND c.left_at IS NULL AND s.ended_at IS NULL) AS in_call
  FROM office_presence p JOIN "user" u ON u.id = p.user_id`;

const toRecord = (row: Row): OfficePresenceRecord => ({
  userId: row.user_id,
  name: row.name,
  x: Number(row.x),
  y: Number(row.y),
  chosen: isOfficeChosenStatus(row.status) ? row.status : 'available',
  lastSeenAt: row.last_seen_at,
  inCall: row.in_call === true,
});

/** Bound parameters only. Members only: people who left the workspace drop out of the office. */
@Injectable()
export class TypeOrmOfficeRepository extends OfficeRepository {
  constructor(private readonly transactional: TransactionalManager) {
    super();
  }

  private query<T>(sql: string, params: unknown[]): Promise<T[]> {
    return this.transactional.manager.query(sql, params);
  }

  async list(workspaceId: string): Promise<OfficePresenceRecord[]> {
    const rows = await this.query<Row>(
      `${SELECT} WHERE p.workspace_id = $1 AND EXISTS (SELECT 1 FROM workspace_member m WHERE m.workspace_id = p.workspace_id AND m.user_id = p.user_id)
       ORDER BY lower(u.name) LIMIT 500`,
      [workspaceId],
    );
    return rows.map(toRecord);
  }

  async find(workspaceId: string, userId: string): Promise<OfficePresenceRecord | null> {
    const [row] = await this.query<Row>(`${SELECT} WHERE p.workspace_id = $1 AND p.user_id = $2`, [workspaceId, userId]);
    return row ? toRecord(row) : null;
  }

  async occupied(workspaceId: string, x: number, y: number, exceptUserId: string, seenSince: Date): Promise<boolean> {
    const rows = await this.query(`SELECT 1 FROM office_presence WHERE workspace_id = $1 AND x = $2 AND y = $3 AND user_id <> $4 AND last_seen_at > $5`, [
      workspaceId,
      x,
      y,
      exceptUserId,
      seenSince,
    ]);
    return rows.length > 0;
  }

  async save(workspaceId: string, userId: string, state: { x: number; y: number; chosen: string; lastSeenAt: Date }): Promise<void> {
    await this.query(
      `INSERT INTO office_presence (workspace_id, user_id, x, y, status, last_seen_at) VALUES ($1, $2, $3, $4, $5, $6)
       ON CONFLICT (workspace_id, user_id) DO UPDATE SET x = EXCLUDED.x, y = EXCLUDED.y, status = EXCLUDED.status, last_seen_at = EXCLUDED.last_seen_at`,
      [workspaceId, userId, state.x, state.y, state.chosen, state.lastSeenAt],
    );
  }
}
