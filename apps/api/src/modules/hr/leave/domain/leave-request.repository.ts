import type { LeaveStatus } from '@taskflow/shared-types';
import type { PageRequest } from '../../../../core/http/dto/page-query.dto.js';
import type { LeaveRequest, LeaveRequestView, NewLeaveRequest } from './leave-request.js';

export abstract class LeaveRequestRepository {
  abstract findInWorkspace(workspaceId: string, requestId: string): Promise<LeaveRequestView | null>;
  /** Newest first. */
  abstract listForUser(workspaceId: string, userId: string, limit: number): Promise<LeaveRequestView[]>;
  /** Oldest pending first, so the queue is fair. */
  abstract page(workspaceId: string, status: LeaveStatus | undefined, page: PageRequest): Promise<{ items: LeaveRequestView[]; total: number }>;
  /** True when the user has a pending or approved request overlapping the range. */
  abstract hasOverlap(workspaceId: string, userId: string, startDate: string, endDate: string): Promise<boolean>;
  /** Pending working days per leave type for a user in a year. */
  abstract pendingDaysByType(workspaceId: string, userId: string, year: number): Promise<Map<string, number>>;
  abstract create(request: NewLeaveRequest): Promise<LeaveRequest>;
  abstract save(request: LeaveRequest): Promise<LeaveRequest>;
}
