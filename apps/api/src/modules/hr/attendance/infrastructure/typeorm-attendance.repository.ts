import { Injectable } from '@nestjs/common';
import type { AttendanceBreak } from '@taskflow/shared-types';
import { TransactionalManager } from '../../../../core/database/transactional-manager.js';
import { AttendanceRepository, type AttendanceCorrection, type AttendanceShift } from '../domain/attendance.repository.js';

interface Row {
  id: string;
  workspace_id: string;
  user_id: string;
  started_at: Date;
  ended_at: Date | null;
  breaks: AttendanceBreak[];
  corrected_by_id: string | null;
  corrected_at: Date | null;
  correction_reason: string | null;
}

const COLUMNS = 'id, workspace_id, user_id, started_at, ended_at, breaks, corrected_by_id, corrected_at, correction_reason';
const toShift = (row: Row): AttendanceShift => ({
  id: row.id,
  workspaceId: row.workspace_id,
  userId: row.user_id,
  startedAt: new Date(row.started_at),
  endedAt: row.ended_at ? new Date(row.ended_at) : null,
  breaks: row.breaks ?? [],
  correction: row.corrected_at ? { byId: row.corrected_by_id, at: new Date(row.corrected_at), reason: row.correction_reason ?? '' } : null,
});
/** UPDATE … RETURNING comes back as [rows, count]; SELECT and INSERT as rows. */
const rowsOf = (result: unknown): Row[] => (Array.isArray(result) && Array.isArray(result[0]) ? (result[0] as Row[]) : (result as Row[]));

/** Bound parameters only; every statement names the workspace and, for writes, the person. */
@Injectable()
export class TypeOrmAttendanceRepository extends AttendanceRepository {
  constructor(private readonly transactional: TransactionalManager) {
    super();
  }

  private async query(sql: string, params: unknown[]): Promise<AttendanceShift[]> {
    return rowsOf(await this.transactional.manager.query(sql, params)).map(toShift);
  }

  async lockOpen(workspaceId: string, userId: string): Promise<AttendanceShift | null> {
    const [shift] = await this.query(`SELECT ${COLUMNS} FROM attendance_shift WHERE workspace_id = $1 AND user_id = $2 AND ended_at IS NULL FOR UPDATE`, [workspaceId, userId]);
    return shift ?? null;
  }

  async insertOpen(workspaceId: string, userId: string, startedAt: Date): Promise<AttendanceShift | null> {
    const [shift] = await this.query(
      `INSERT INTO attendance_shift (workspace_id, user_id, started_at) VALUES ($1, $2, $3)
       ON CONFLICT (workspace_id, user_id) WHERE ended_at IS NULL DO NOTHING RETURNING ${COLUMNS}`,
      [workspaceId, userId, startedAt],
    );
    return shift ?? null;
  }

  async save(shift: AttendanceShift): Promise<AttendanceShift> {
    const [saved] = await this.query(
      `UPDATE attendance_shift SET ended_at = $4, breaks = $5::jsonb, updated_at = now()
       WHERE workspace_id = $1 AND user_id = $2 AND id = $3 RETURNING ${COLUMNS}`,
      [shift.workspaceId, shift.userId, shift.id, shift.endedAt, JSON.stringify(shift.breaks)],
    );
    if (!saved) throw new Error('Attendance shift vanished while saving');
    return saved;
  }

  recent(workspaceId: string, userId: string, limit: number): Promise<AttendanceShift[]> {
    return this.query(`SELECT ${COLUMNS} FROM attendance_shift WHERE workspace_id = $1 AND user_id = $2 ORDER BY started_at DESC LIMIT $3`, [workspaceId, userId, limit]);
  }

  overlapping(workspaceId: string, from: Date, to: Date, limit: number): Promise<AttendanceShift[]> {
    return this.query(
      `SELECT ${COLUMNS} FROM attendance_shift
       WHERE workspace_id = $1 AND started_at < $3 AND (ended_at IS NULL OR ended_at >= $2)
       ORDER BY started_at LIMIT $4`,
      [workspaceId, from, to, limit],
    );
  }

  async find(workspaceId: string, id: string): Promise<AttendanceShift | null> {
    const [shift] = await this.query(`SELECT ${COLUMNS} FROM attendance_shift WHERE workspace_id = $1 AND id = $2`, [workspaceId, id]);
    return shift ?? null;
  }

  async overlapsAnother(shift: AttendanceShift, startedAt: Date, endedAt: Date): Promise<boolean> {
    const rows: unknown[] = await this.transactional.manager.query(
      `SELECT 1 FROM attendance_shift
       WHERE workspace_id = $1 AND user_id = $2 AND id <> $3 AND started_at < $5 AND (ended_at IS NULL OR ended_at > $4) LIMIT 1`,
      [shift.workspaceId, shift.userId, shift.id, startedAt, endedAt],
    );
    return rows.length > 0;
  }

  async correct(shift: AttendanceShift, change: AttendanceCorrection): Promise<AttendanceShift | null> {
    const [saved] = await this.query(
      `UPDATE attendance_shift
          SET started_at = $4, ended_at = $5, breaks = $6::jsonb, corrected_by_id = $7, corrected_at = $8, correction_reason = $9, updated_at = now()
        WHERE workspace_id = $1 AND user_id = $2 AND id = $3 RETURNING ${COLUMNS}`,
      [shift.workspaceId, shift.userId, shift.id, change.startedAt, change.endedAt, JSON.stringify(change.breaks), change.byId, change.at, change.reason],
    );
    return saved ?? null;
  }

  async memberNames(workspaceId: string, userIds: readonly string[]): Promise<Map<string, string>> {
    if (userIds.length === 0) return new Map();
    const rows: { id: string; name: string }[] = await this.transactional.manager.query(
      `SELECT u.id, u.name FROM "user" u JOIN workspace_member m ON m.user_id = u.id AND m.workspace_id = $1 WHERE u.id = ANY($2::text[])`,
      [workspaceId, [...userIds]],
    );
    return new Map(rows.map((row) => [row.id, row.name]));
  }
}
