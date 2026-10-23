import type { LeaveType, NewLeaveType } from './leave-type.js';

export abstract class LeaveTypeRepository {
  abstract list(workspaceId: string): Promise<LeaveType[]>;
  abstract findInWorkspace(workspaceId: string, leaveTypeId: string): Promise<LeaveType | null>;
  abstract create(leaveType: NewLeaveType): Promise<LeaveType>;
  abstract save(leaveType: LeaveType): Promise<LeaveType>;
  /** Fails with a foreign-key conflict while requests use the type. */
  abstract delete(workspaceId: string, leaveTypeId: string): Promise<void>;
}
