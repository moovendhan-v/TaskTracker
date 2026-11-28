import { Injectable } from '@nestjs/common';
import { TransactionalManager } from '../../../core/database/transactional-manager.js';
import { ApiTokenRepository, type ApiTokenOwner, type ApiTokenRecord, type NewPendingToken } from '../domain/api-token.repository.js';

const COLUMNS = `t.id, t.workspace_id, t.user_id, t.name, t.client, t.scopes, t.token_prefix, (t.token_hash IS NULL) AS pending,
  t.created_at, t.expires_at, t.last_used_at, t.revoked_at`;

const toRecord = (row: Record<string, unknown>): ApiTokenRecord => ({
  id: row['id'] as string,
  workspaceId: row['workspace_id'] as string,
  userId: row['user_id'] as string,
  name: row['name'] as string,
  client: row['client'] as ApiTokenRecord['client'],
  scopes: row['scopes'] as ApiTokenRecord['scopes'],
  prefix: (row['token_prefix'] as string | null) ?? null,
  pending: Boolean(row['pending']),
  createdAt: new Date(row['created_at'] as string),
  expiresAt: new Date(row['expires_at'] as string),
  lastUsedAt: row['last_used_at'] ? new Date(row['last_used_at'] as string) : null,
  revokedAt: row['revoked_at'] ? new Date(row['revoked_at'] as string) : null,
});

/** UPDATE … RETURNING comes back from TypeORM as [rows, count]. */
const rowsOf = (result: unknown): Record<string, unknown>[] => (Array.isArray(result) && Array.isArray(result[0]) ? (result[0] as Record<string, unknown>[]) : (result as Record<string, unknown>[]));

@Injectable()
export class TypeOrmApiTokenRepository extends ApiTokenRepository {
  constructor(private readonly transactional: TransactionalManager) {
    super();
  }

  private query(sql: string, params: unknown[]): Promise<unknown> {
    return this.transactional.manager.query(sql, params);
  }

  async insertPending(token: NewPendingToken): Promise<ApiTokenRecord> {
    // Approvals nobody picked up are of no use: clear this person's expired ones first.
    await this.query(`DELETE FROM api_token WHERE workspace_id = $1 AND user_id = $2 AND token_hash IS NULL AND challenge_expires_at < now()`, [token.workspaceId, token.userId]);
    const rows = rowsOf(
      await this.query(
        `INSERT INTO api_token AS t (workspace_id, user_id, name, client, scopes, challenge_hash, challenge_expires_at, expires_at)
         VALUES ($1, $2, $3, $4, $5::text[], $6, $7, $8) RETURNING ${COLUMNS}`,
        [token.workspaceId, token.userId, token.name, token.client, [...token.scopes], token.challengeHash, token.challengeExpiresAt, token.expiresAt],
      ),
    );
    return toRecord(rows[0]!);
  }

  async insertIssued(token: Omit<NewPendingToken, 'challengeHash' | 'challengeExpiresAt'> & { tokenHash: string; prefix: string }): Promise<ApiTokenRecord> {
    const rows = rowsOf(
      await this.query(
        `INSERT INTO api_token AS t (workspace_id, user_id, name, client, scopes, token_hash, token_prefix, expires_at)
         VALUES ($1, $2, $3, $4, $5::text[], $6, $7, $8) RETURNING ${COLUMNS}`,
        [token.workspaceId, token.userId, token.name, token.client, [...token.scopes], token.tokenHash, token.prefix, token.expiresAt],
      ),
    );
    return toRecord(rows[0]!);
  }

  async listOwn(workspaceId: string, userId: string): Promise<ApiTokenRecord[]> {
    const rows = rowsOf(
      await this.query(
        `SELECT ${COLUMNS} FROM api_token t
          WHERE t.workspace_id = $1 AND t.user_id = $2 AND t.revoked_at IS NULL AND t.expires_at > now()
            AND (t.token_hash IS NOT NULL OR t.challenge_expires_at > now())
          ORDER BY t.created_at DESC LIMIT 100`,
        [workspaceId, userId],
      ),
    );
    return rows.map(toRecord);
  }

  async countActive(workspaceId: string, userId: string): Promise<number> {
    const rows = rowsOf(await this.query(`SELECT count(*)::int AS n FROM api_token WHERE workspace_id = $1 AND user_id = $2 AND revoked_at IS NULL AND expires_at > now()`, [workspaceId, userId]));
    return Number(rows[0]?.['n'] ?? 0);
  }

  async revoke(workspaceId: string, userId: string, id: string): Promise<boolean> {
    const rows = rowsOf(await this.query(`UPDATE api_token SET revoked_at = now() WHERE workspace_id = $1 AND user_id = $2 AND id = $3 AND revoked_at IS NULL RETURNING id`, [workspaceId, userId, id]));
    return rows.length > 0;
  }

  async issue(challengeHash: string, tokenHash: string, prefix: string): Promise<ApiTokenRecord | null> {
    // Single use: the challenge is cleared in the same statement that sets the token.
    const rows = rowsOf(
      await this.query(
        `UPDATE api_token AS t SET token_hash = $2, token_prefix = $3, challenge_hash = NULL, challenge_expires_at = NULL
          WHERE t.challenge_hash = $1 AND t.token_hash IS NULL AND t.challenge_expires_at > now() AND t.revoked_at IS NULL
          RETURNING ${COLUMNS}`,
        [challengeHash, tokenHash, prefix],
      ),
    );
    return rows[0] ? toRecord(rows[0]) : null;
  }

  async findByTokenHash(tokenHash: string): Promise<ApiTokenOwner | null> {
    const rows = rowsOf(
      await this.query(`SELECT ${COLUMNS}, u.name AS user_name, u.email AS user_email FROM api_token t JOIN "user" u ON u.id = t.user_id WHERE t.token_hash = $1`, [tokenHash]),
    );
    const row = rows[0];
    return row ? { ...toRecord(row), userName: row['user_name'] as string, userEmail: row['user_email'] as string } : null;
  }

  async touch(id: string): Promise<void> {
    // At most once a minute: it's for "last used", not an access log.
    await this.query(`UPDATE api_token SET last_used_at = now() WHERE id = $1 AND (last_used_at IS NULL OR last_used_at < now() - interval '1 minute')`, [id]);
  }

  async revokeById(id: string): Promise<void> {
    await this.query(`UPDATE api_token SET revoked_at = now() WHERE id = $1 AND revoked_at IS NULL`, [id]);
  }

  async workspaceName(workspaceId: string): Promise<string | null> {
    const rows = rowsOf(await this.query(`SELECT name FROM workspace WHERE id = $1`, [workspaceId]));
    return (rows[0]?.['name'] as string | undefined) ?? null;
  }
}
