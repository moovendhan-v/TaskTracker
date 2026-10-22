export interface BalanceKey {
  workspaceId: string;
  userId: string;
  leaveTypeId: string;
  year: number;
}

/**
 * Approved days used per person, type and year. Call `lockUsedDays` inside a
 * transaction before changing a balance, so concurrent approvals can't overspend.
 */
export abstract class LeaveBalanceRepository {
  /** Creates the balance row if needed, locks it until the transaction ends, and returns used days. */
  abstract lockUsedDays(key: BalanceKey): Promise<number>;
  abstract addUsedDays(key: BalanceKey, delta: number): Promise<void>;
  abstract usedDaysByType(workspaceId: string, userId: string, year: number): Promise<Map<string, number>>;
}
