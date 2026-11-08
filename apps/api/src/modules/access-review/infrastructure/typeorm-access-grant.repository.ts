import { Injectable } from '@nestjs/common';
import type { AccessGrantResponse, AccessRequestResponse, AccessRequestStatus } from '@taskflow/shared-types';
import { TransactionalManager } from '../../../core/database/transactional-manager.js';
import { AccessGrantRepository, type AccessRequestRecord } from '../domain/access-grant.repository.js';

type Row = Record<string, unknown>;
const iso = (value: unknown) => new Date(value as string).toISOString();
/** UPDATE/DELETE … RETURNING come back as [rows, count]; SELECT and INSERT as rows. */
const rowsOf = (result: unknown): Row[] => (Array.isArray(result) && Array.isArray(result[0]) ? (result[0] as Row[]) : (result as Row[]));

const REQUEST_SELECT = `
  SELECT r.id, r.workspace_id, r.requester_id, u.name AS requester_name, r.permission, r.space_id, s.name AS space_name, r.note, r.status, r.created_at
  FROM access_request r JOIN "user" u ON u.id = r.requester_id LEFT JOIN space s ON s.id = r.space_id`;
const toRequest = (row: Row): AccessRequestRecord => ({
  id: row['id'] as string,
  workspaceId: row['workspace_id'] as string,
  requesterId: row['requester_id'] as string,
  requesterName: row['requester_name'] as string,
  permission: row['permission'] as string,
  spaceId: (row['space_id'] as string | null) ?? null,
  spaceName: (row['space_name'] as string | null) ?? null,
  note: row['note'] as string,
  status: row['status'] as AccessRequestStatus,
  createdAt: iso(row['created_at']),
});

const GRANT_SELECT = `
  SELECT g.id, g.user_id, u.name AS user_name, g.permission, g.space_id, s.name AS space_name, g.expires_at, b.name AS granted_by_name, g.created_at
  FROM access_grant g JOIN "user" u ON u.id = g.user_id LEFT JOIN space s ON s.id = g.space_id LEFT JOIN "user" b ON b.id = g.granted_by`;
const toGrant = (row: Row): AccessGrantResponse => ({
  id: row['id'] as string,
  userId: row['user_id'] as string,
  userName: row['user_name'] as string,
  permission: row['permission'] as string,
  spaceId: (row['space_id'] as string | null) ?? null,
  spaceName: (row['space_name'] as string | null) ?? null,
  expiresAt: iso(row['expires_at']),
  grantedByName: (row['granted_by_name'] as string | null) ?? null,
  createdAt: iso(row['created_at']),
});

/** Bound parameters only; every statement names the workspace, and row-level security agrees. */
@Injectable()
export class TypeOrmAccessGrantRepository extends AccessGrantRepository {
  constructor(private readonly transactional: TransactionalManager) {
    super();
  }

  private async query(sql: string, params: unknown[]): Promise<Row[]> {
    return rowsOf(await this.transactional.manager.query(sql, params));
  }

  async createRequest(input: { workspaceId: string; requesterId: string; permission: string; spaceId: string | null; note: string }): Promise<string> {
    const [row] = await this.query(`INSERT INTO access_request (workspace_id, requester_id, permission, space_id, note) VALUES ($1, $2, $3, $4, $5) RETURNING id`, [
      input.workspaceId,
      input.requesterId,
      input.permission,
      input.spaceId,
      input.note,
    ]);
    return row!['id'] as string;
  }

  async findRequest(workspaceId: string, id: string): Promise<AccessRequestRecord | null> {
    const [row] = await this.query(`${REQUEST_SELECT} WHERE r.workspace_id = $1 AND r.id = $2`, [workspaceId, id]);
    return row ? toRequest(row) : null;
  }

  async listRequests(workspaceId: string, status: AccessRequestStatus, limit: number): Promise<AccessRequestResponse[]> {
    const rows = await this.query(`${REQUEST_SELECT} WHERE r.workspace_id = $1 AND r.status = $2 ORDER BY r.created_at DESC LIMIT $3`, [workspaceId, status, limit]);
    return rows.map((row) => {
      const { workspaceId: _workspace, ...request } = toRequest(row);
      return request;
    });
  }

  async decideRequest(workspaceId: string, id: string, status: Exclude<AccessRequestStatus, 'pending'>, decidedBy: string): Promise<boolean> {
    const rows = await this.query(`UPDATE access_request SET status = $3, decided_by = $4, decided_at = now() WHERE workspace_id = $1 AND id = $2 AND status = 'pending' RETURNING id`, [
      workspaceId,
      id,
      status,
      decidedBy,
    ]);
    return rows.length > 0;
  }

  async createGrant(input: { workspaceId: string; userId: string; permission: string; spaceId: string | null; expiresAt: Date; grantedBy: string; requestId: string | null }): Promise<string> {
    const [row] = await this.query(
      `INSERT INTO access_grant (workspace_id, user_id, permission, space_id, expires_at, granted_by, request_id) VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id`,
      [input.workspaceId, input.userId, input.permission, input.spaceId, input.expiresAt, input.grantedBy, input.requestId],
    );
    return row!['id'] as string;
  }

  async listActiveGrants(workspaceId: string, now: Date, limit: number): Promise<AccessGrantResponse[]> {
    const rows = await this.query(`${GRANT_SELECT} WHERE g.workspace_id = $1 AND g.expires_at > $2 ORDER BY g.expires_at LIMIT $3`, [workspaceId, now, limit]);
    return rows.map(toGrant);
  }

  async findGrant(workspaceId: string, id: string): Promise<AccessGrantResponse | null> {
    const [row] = await this.query(`${GRANT_SELECT} WHERE g.workspace_id = $1 AND g.id = $2`, [workspaceId, id]);
    return row ? toGrant(row) : null;
  }

  async deleteGrant(workspaceId: string, id: string): Promise<boolean> {
    const rows = await this.query(`DELETE FROM access_grant WHERE workspace_id = $1 AND id = $2 RETURNING id`, [workspaceId, id]);
    return rows.length > 0;
  }
}
