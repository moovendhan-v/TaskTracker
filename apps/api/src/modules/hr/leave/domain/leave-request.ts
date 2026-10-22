import type { LeaveStatus } from '@taskflow/shared-types';

export interface LeaveRequest {
  id: string;
  workspaceId: string;
  userId: string;
  leaveTypeId: string;
  /** yyyy-mm-dd */
  startDate: string;
  /** yyyy-mm-dd */
  endDate: string;
  days: number;
  reason: string;
  status: LeaveStatus;
  decidedById: string | null;
  decidedAt: Date | null;
  decisionNote: string;
  createdAt: Date;
  updatedAt: Date;
}

export type NewLeaveRequest = Omit<LeaveRequest, 'id' | 'createdAt' | 'updatedAt' | 'decidedById' | 'decidedAt' | 'decisionNote'> &
  Partial<Pick<LeaveRequest, 'decidedById' | 'decidedAt' | 'decisionNote'>>;

/** A request with the names the UI shows. */
export interface LeaveRequestView extends LeaveRequest {
  userName: string;
  leaveTypeName: string;
}

export const leaveYear = (isoDate: string): number => Number(isoDate.slice(0, 4));
