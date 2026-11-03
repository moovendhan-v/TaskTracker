import { Injectable } from '@nestjs/common';
import type { AttendanceBreak } from '@taskflow/shared-types';
import { TransactionalManager } from '../../../../core/database/transactional-manager.js';
import { AttendanceRepository, type AttendanceShift } from '../domain/attendance.repository.js';

interface Row {
  id: string;
  workspace_id: string;
  user_id: string;
  started_at: Date;
  ended_at: Date | null;
  breaks: AttendanceBreak[];
}

const COLUMNS = 'id, workspace_id, user_id, started_at, ended_at, breaks';
const toShift = (row: Row): AttendanceShift => ({
  id: row.id,
  workspaceId: row.workspace_id,
  userId: row.user_id,
  startedAt: new Date(row.started_at),
  endedAt: row.ended_at ? new Date(row.ended_at) : null,
  breaks: row.breaks ?? [],
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
}
