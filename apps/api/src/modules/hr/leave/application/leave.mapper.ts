import type { LeaveBalanceResponse, LeaveRequestResponse, LeaveTypeResponse } from '@taskflow/shared-types';
import type { LeaveRequestView } from '../domain/leave-request.js';
import type { LeaveType } from '../domain/leave-type.js';

export const LeaveMapper = {
  type(leaveType: LeaveType): LeaveTypeResponse {
    return {
      id: leaveType.id,
      name: leaveType.name,
      color: leaveType.color,
      annualAllowanceDays: leaveType.annualAllowanceDays,
      requiresApproval: leaveType.requiresApproval,
    };
  },

  request(request: LeaveRequestView): LeaveRequestResponse {
    return {
      id: request.id,
      userId: request.userId,
      userName: request.userName,
      leaveTypeId: request.leaveTypeId,
      leaveTypeName: request.leaveTypeName,
      startDate: request.startDate,
      endDate: request.endDate,
      days: request.days,
      reason: request.reason,
      status: request.status,
      decidedById: request.decidedById,
      decidedAt: request.decidedAt ? request.decidedAt.toISOString() : null,
      decisionNote: request.decisionNote,
      createdAt: request.createdAt.toISOString(),
    };
  },

  balance(
    leaveType: Pick<LeaveType, 'id' | 'name' | 'color' | 'annualAllowanceDays'>,
    year: number,
    usedDays: number,
    pendingDays: number,
  ): LeaveBalanceResponse {
    const allowance = leaveType.annualAllowanceDays;
    return {
      leaveTypeId: leaveType.id,
      leaveTypeName: leaveType.name,
      color: leaveType.color,
      year,
      allowanceDays: allowance,
      usedDays,
      pendingDays,
      remainingDays: allowance === null ? null : Math.max(allowance - usedDays, 0),
    };
  },
};
