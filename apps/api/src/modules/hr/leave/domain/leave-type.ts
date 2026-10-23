export interface LeaveType {
  id: string;
  workspaceId: string;
  name: string;
  color: string;
  /** null means unlimited. */
  annualAllowanceDays: number | null;
  requiresApproval: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export type NewLeaveType = Pick<LeaveType, 'workspaceId' | 'name' | 'color' | 'annualAllowanceDays' | 'requiresApproval'>;
