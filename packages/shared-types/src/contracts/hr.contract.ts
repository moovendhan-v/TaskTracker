import type { AttendanceBreak } from '../domain/attendance.js';
import type { EmploymentType, LeaveDecision, LeaveStatus } from '../domain/hr.js';

export interface DepartmentResponse {
  id: string;
  name: string;
  headUserId: string | null;
  memberCount: number;
}

export interface CreateDepartmentRequest {
  name: string;
  headUserId?: string | null;
}

export type UpdateDepartmentRequest = Partial<CreateDepartmentRequest>;

/** One row per current workspace member; profile fields are null until HR fills them in. */
export interface EmployeeResponse {
  userId: string;
  name: string;
  /** Null unless a policy lets the caller read `member.email`. */
  email: string | null;
  jobTitle: string | null;
  departmentId: string | null;
  departmentName: string | null;
  managerUserId: string | null;
  employmentType: EmploymentType | null;
  /** yyyy-mm-dd */
  startDate: string | null;
}

export interface UpsertEmployeeProfileRequest {
  jobTitle?: string | null;
  departmentId?: string | null;
  managerUserId?: string | null;
  employmentType?: EmploymentType | null;
  startDate?: string | null;
}

export interface LeaveTypeResponse {
  id: string;
  name: string;
  color: string;
  /** null means unlimited. */
  annualAllowanceDays: number | null;
  requiresApproval: boolean;
}

export interface CreateLeaveTypeRequest {
  name: string;
  color?: string;
  annualAllowanceDays: number | null;
  requiresApproval?: boolean;
}

export type UpdateLeaveTypeRequest = Partial<CreateLeaveTypeRequest>;

export interface LeaveRequestResponse {
  id: string;
  userId: string;
  userName: string;
  leaveTypeId: string;
  leaveTypeName: string;
  /** yyyy-mm-dd */
  startDate: string;
  /** yyyy-mm-dd */
  endDate: string;
  /** Working days (Mon–Fri) in the range. */
  days: number;
  reason: string;
  status: LeaveStatus;
  decidedById: string | null;
  decidedAt: string | null;
  decisionNote: string;
  createdAt: string;
}

export interface CreateLeaveRequestRequest {
  leaveTypeId: string;
  startDate: string;
  endDate: string;
  reason?: string;
}

export interface DecideLeaveRequestRequest {
  decision: LeaveDecision;
  note?: string;
}

export interface LeaveRequestQuery {
  status?: LeaveStatus;
  page?: number;
  pageSize?: number;
}

export interface LeaveBalanceResponse {
  leaveTypeId: string;
  leaveTypeName: string;
  color: string;
  year: number;
  /** null means unlimited. */
  allowanceDays: number | null;
  usedDays: number;
  pendingDays: number;
  /** null means unlimited. */
  remainingDays: number | null;
}

/**
 * Who is away when, for capacity planning: approved leave only, without the
 * type, reason or notes (those stay with the person and their approvers).
 */
export interface TeamAbsenceResponse {
  userId: string;
  /** yyyy-mm-dd */
  startDate: string;
  /** yyyy-mm-dd */
  endDate: string;
}

/** Longest range one availability query may cover (at least the longest sprint). */
export const AVAILABILITY_MAX_DAYS = 92;

export interface AttendanceShiftResponse {
  id: string;
  userId: string;
  startedAt: string;
  /** Null while clocked in. */
  endedAt: string | null;
  breaks: AttendanceBreak[];
  onBreak: boolean;
  /** Worked so far: length minus breaks, as of the server's now. */
  workedMinutes: number;
  /** Set when HR corrected the times (with who and why). */
  correctedAt: string | null;
  correctedById: string | null;
  correctionReason: string | null;
}

/** HR's fix to a shift's times. The server keeps breaks inside the new times. */
export interface CorrectAttendanceShiftInput {
  startedAt: string;
  endedAt: string;
  /** Why (shown on the shift and kept in the audit log). */
  reason: string;
}

/** The team's shifts as a CSV file, made on the server. */
export interface AttendanceExportResponse {
  fileName: string;
  content: string;
  shifts: number;
  truncated: boolean;
}

export interface MyAttendanceResponse {
  /** The open shift, if you're clocked in. */
  current: AttendanceShiftResponse | null;
  /** Your latest shifts, newest first (the open one included). */
  recent: AttendanceShiftResponse[];
}
