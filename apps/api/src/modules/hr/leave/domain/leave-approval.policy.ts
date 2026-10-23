import type { Permission } from '@taskflow/shared-types';
import { DomainError } from '../../../../core/domain/domain-error.js';
import type { LeaveRequest } from './leave-request.js';

/** Who may decide on or cancel time off, and whether the allowance covers it. */
export const LeaveApprovalPolicy = {
  assertCanDecide(request: LeaveRequest, approverId: string, held: ReadonlySet<Permission>): void {
    if (!held.has('leave.approve')) throw DomainError.forbidden('Missing leave.approve permission');
    if (request.userId === approverId) throw DomainError.forbidden('You can’t decide on your own time off');
    if (request.status !== 'pending') throw DomainError.invalid('This request has already been decided');
  },

  /** @param allowance null means unlimited */
  assertWithinAllowance(allowance: number | null, alreadyCommitted: number, requested: number): void {
    if (allowance === null) return;
    const remaining = allowance - alreadyCommitted;
    if (requested > remaining) {
      throw DomainError.conflict(`Not enough allowance: ${Math.max(remaining, 0)} day(s) left, ${requested} requested`);
    }
  },

  /** People cancel their own pending requests, or approved ones that haven't started. */
  assertCanCancel(request: LeaveRequest, userId: string, today: string): void {
    if (request.userId !== userId) throw DomainError.forbidden('You can only cancel your own time off');
    if (request.status === 'pending') return;
    if (request.status === 'approved' && request.startDate > today) return;
    throw DomainError.invalid('Only pending requests, or approved time off that hasn’t started, can be cancelled');
  },
};
