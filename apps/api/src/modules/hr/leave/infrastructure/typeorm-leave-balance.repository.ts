import { Injectable } from '@nestjs/common';
import { TransactionalManager } from '../../../../core/database/transactional-manager.js';
import { LeaveBalanceRepository, type BalanceKey } from '../domain/leave-balance.repository.js';

/** Bound parameters only. The balance table has no entity; it's an internal counter. */
@Injectable()
export class TypeOrmLeaveBalanceRepository extends LeaveBalanceRepository {
  constructor(private readonly transactional: TransactionalManager) {
    super();
  }

  async lockUsedDays(key: BalanceKey): Promise<number> {
    if (!this.transactional.inTransaction) throw new Error('lockUsedDays must run inside a transaction');
    const params = [key.workspaceId, key.userId, key.leaveTypeId, key.year];
    await this.transactional.manager.query(
      `INSERT INTO leave_balance (workspace_id, user_id, leave_type_id, year, used_days)
       VALUES ($1, $2, $3, $4, 0)
       ON CONFLICT (workspace_id, user_id, leave_type_id, year) DO NOTHING`,
      params,
    );
    const rows: { used_days: number | string }[] = await this.transactional.manager.query(
      `SELECT used_days FROM leave_balance
       WHERE workspace_id = $1 AND user_id = $2 AND leave_type_id = $3 AND year = $4
       FOR UPDATE`,
      params,
    );
    return Number(rows[0]?.used_days ?? 0);
  }

  async addUsedDays(key: BalanceKey, delta: number): Promise<void> {
    await this.transactional.manager.query(
      `UPDATE leave_balance SET used_days = used_days + $5, updated_at = now()
       WHERE workspace_id = $1 AND user_id = $2 AND leave_type_id = $3 AND year = $4`,
      [key.workspaceId, key.userId, key.leaveTypeId, key.year, delta],
    );
  }

  async usedDaysByType(workspaceId: string, userId: string, year: number): Promise<Map<string, number>> {
    const rows: { leave_type_id: string; used_days: number | string }[] = await this.transactional.manager.query(
      `SELECT leave_type_id, used_days FROM leave_balance WHERE workspace_id = $1 AND user_id = $2 AND year = $3`,
      [workspaceId, userId, year],
    );
    return new Map(rows.map((row) => [row.leave_type_id, Number(row.used_days)]));
  }
}
