import { Injectable } from '@nestjs/common';
import { TransactionalManager } from '../../../core/database/transactional-manager.js';
import { IntakeRepository, type IntakeRecord, type IntakeSettings, type ShareRecord } from '../domain/intake.repository.js';

const INTAKE = `i.id, i.workspace_id, i.space_id, s.name AS space_name, i.public_key, i.title, i.intro, i.allowed_origins, i.widget_enabled, i.portal_enabled, i.created_by, i.updated_at`;
const INTAKE_FROM = `FROM bug_intake i JOIN space s ON s.id = i.space_id`;
const SHARE = `b.id, b.workspace_id, b.task_id, b.scope, b.created_by, u.name AS created_by_name, b.created_at, b.expires_at, b.revoked_at, b.last_viewed_at`;
const SHARE_FROM = `FROM bug_share b LEFT JOIN "user" u ON u.id = b.created_by`;

type Row = Record<string, unknown>;
/** UPDATE … RETURNING comes back from TypeORM as [rows, count]. */
const rowsOf = (result: unknown): Row[] => (Array.isArray(result) && Array.isArray(result[0]) ? (result[0] as Row[]) : (result as Row[]));
const date = (value: unknown) => (value ? new Date(value as string) : null);

const toIntake = (row: Row): IntakeRecord => ({
  id: row['id'] as string,
  workspaceId: row['workspace_id'] as string,
  spaceId: row['space_id'] as string,
  spaceName: row['space_name'] as string,
  publicKey: row['public_key'] as string,
  title: row['title'] as string,
  intro: row['intro'] as string,
  allowedOrigins: (row['allowed_origins'] as string[]) ?? [],
  widgetEnabled: Boolean(row['widget_enabled']),
  portalEnabled: Boolean(row['portal_enabled']),
  createdBy: row['created_by'] as string,
  updatedAt: new Date(row['updated_at'] as string),
});

const toShare = (row: Row): ShareRecord => ({
  id: row['id'] as string,
  workspaceId: row['workspace_id'] as string,
  taskId: row['task_id'] as string,
  scope: row['scope'] as ShareRecord['scope'],
  createdBy: (row['created_by'] as string | null) ?? null,
  createdByName: (row['created_by_name'] as string | null) ?? null,
  createdAt: new Date(row['created_at'] as string),
  expiresAt: new Date(row['expires_at'] as string),
  revokedAt: date(row['revoked_at']),
  lastViewedAt: date(row['last_viewed_at']),
});

@Injectable()
export class TypeOrmIntakeRepository extends IntakeRepository {
  constructor(private readonly transactional: TransactionalManager) {
    super();
  }

  private async rows(sql: string, params: unknown[]): Promise<Row[]> {
    return rowsOf(await this.transactional.manager.query(sql, params));
  }

  async findBySpace(workspaceId: string, spaceId: string): Promise<IntakeRecord | null> {
    const [row] = await this.rows(`SELECT ${INTAKE} ${INTAKE_FROM} WHERE i.workspace_id = $1 AND i.space_id = $2`, [workspaceId, spaceId]);
    return row ? toIntake(row) : null;
  }

  async save(workspaceId: string, spaceId: string, createdBy: string, publicKey: string, settings: IntakeSettings): Promise<IntakeRecord> {
    await this.rows(
      `INSERT INTO bug_intake (workspace_id, space_id, public_key, title, intro, allowed_origins, widget_enabled, portal_enabled, created_by)
       VALUES ($1, $2, $3, $4, $5, $6::text[], $7, $8, $9)
       ON CONFLICT (space_id) DO UPDATE SET title = EXCLUDED.title, intro = EXCLUDED.intro, allowed_origins = EXCLUDED.allowed_origins,
         widget_enabled = EXCLUDED.widget_enabled, portal_enabled = EXCLUDED.portal_enabled,
         -- Whoever turns it on vouches for it: reports are filed as them.
         created_by = EXCLUDED.created_by, updated_at = now()
       WHERE bug_intake.workspace_id = EXCLUDED.workspace_id`,
      [workspaceId, spaceId, publicKey, settings.title, settings.intro, settings.allowedOrigins, settings.widgetEnabled, settings.portalEnabled, createdBy],
    );
    return (await this.findBySpace(workspaceId, spaceId))!;
  }

  async rotateKey(workspaceId: string, spaceId: string, publicKey: string): Promise<IntakeRecord | null> {
    await this.rows(`UPDATE bug_intake SET public_key = $3, updated_at = now() WHERE workspace_id = $1 AND space_id = $2`, [workspaceId, spaceId, publicKey]);
    return this.findBySpace(workspaceId, spaceId);
  }

  async countPublicReports(workspaceId: string, spaceId: string, since: Date): Promise<number> {
    const [row] = await this.rows(
      `SELECT count(*)::int AS n FROM bug_report b JOIN task t ON t.id = b.task_id
        WHERE b.workspace_id = $1 AND t.space_id = $2 AND b.source IN ('sdk', 'portal') AND b.created_at > $3`,
      [workspaceId, spaceId, since],
    );
    return Number(row?.['n'] ?? 0);
  }

  async insertShare(share: { workspaceId: string; taskId: string; tokenHash: string; scope: ShareRecord['scope']; createdBy: string | null; expiresAt: Date }): Promise<ShareRecord> {
    const [inserted] = await this.rows(
      `INSERT INTO bug_share (workspace_id, task_id, token_hash, scope, created_by, expires_at) VALUES ($1, $2, $3, $4, $5, $6) RETURNING id`,
      [share.workspaceId, share.taskId, share.tokenHash, share.scope, share.createdBy, share.expiresAt],
    );
    const [row] = await this.rows(`SELECT ${SHARE} ${SHARE_FROM} WHERE b.workspace_id = $1 AND b.id = $2`, [share.workspaceId, inserted!['id']]);
    return toShare(row!);
  }

  async listShares(workspaceId: string, taskId: string): Promise<ShareRecord[]> {
    const rows = await this.rows(
      `SELECT ${SHARE} ${SHARE_FROM} WHERE b.workspace_id = $1 AND b.task_id = $2 AND b.revoked_at IS NULL AND b.expires_at > now() ORDER BY b.created_at DESC LIMIT 50`,
      [workspaceId, taskId],
    );
    return rows.map(toShare);
  }

  async revokeShare(workspaceId: string, shareId: string): Promise<ShareRecord | null> {
    const [row] = await this.rows(`UPDATE bug_share SET revoked_at = now() WHERE workspace_id = $1 AND id = $2 AND revoked_at IS NULL RETURNING task_id`, [workspaceId, shareId]);
    if (!row) return null;
    const [share] = await this.rows(`SELECT ${SHARE} ${SHARE_FROM} WHERE b.workspace_id = $1 AND b.id = $2`, [workspaceId, shareId]);
    return share ? toShare(share) : null;
  }

  async touchShare(workspaceId: string, shareId: string): Promise<void> {
    await this.rows(`UPDATE bug_share SET last_viewed_at = now() WHERE workspace_id = $1 AND id = $2 AND (last_viewed_at IS NULL OR last_viewed_at < now() - interval '1 minute')`, [workspaceId, shareId]);
  }

  async findByKey(publicKey: string): Promise<IntakeRecord | null> {
    const [row] = await this.rows(`SELECT ${INTAKE} ${INTAKE_FROM} WHERE i.public_key = $1`, [publicKey]);
    return row ? toIntake(row) : null;
  }

  async findShareByHash(tokenHash: string): Promise<ShareRecord | null> {
    const [row] = await this.rows(`SELECT ${SHARE} ${SHARE_FROM} WHERE b.token_hash = $1`, [tokenHash]);
    return row ? toShare(row) : null;
  }
}
