import type { AttendanceBreak } from '@taskflow/shared-types';

export interface AttendanceShift {
  id: string;
  workspaceId: string;
  userId: string;
  startedAt: Date;
  endedAt: Date | null;
  breaks: AttendanceBreak[];
  /** Set once HR corrected the times. */
  correction: { byId: string | null; at: Date; reason: string } | null;
}

export interface AttendanceCorrection {
  startedAt: Date;
  endedAt: Date;
  breaks: AttendanceBreak[];
  byId: string;
  at: Date;
  reason: string;
}

/**
 * Clocked shifts. Clocking writes only ever touch the caller's own rows (RLS
 * enforces it too); `correct` is HR's, run in platform scope after the service
 * checked hr.manage, and still names the workspace.
 */
export abstract class AttendanceRepository {
  /** The person's open shift, locked for this transaction. */
  abstract lockOpen(workspaceId: string, userId: string): Promise<AttendanceShift | null>;
  /** Null when an open shift already exists (the unique index decides, so races are safe). */
  abstract insertOpen(workspaceId: string, userId: string, startedAt: Date): Promise<AttendanceShift | null>;
  abstract save(shift: AttendanceShift): Promise<AttendanceShift>;
  abstract recent(workspaceId: string, userId: string, limit: number): Promise<AttendanceShift[]>;
  /** Everyone's shifts that overlap [from, to). */
  abstract overlapping(workspaceId: string, from: Date, to: Date, limit: number): Promise<AttendanceShift[]>;
  abstract find(workspaceId: string, id: string): Promise<AttendanceShift | null>;
  /** Whether the person has another shift that overlaps [startedAt, endedAt). */
  abstract overlapsAnother(shift: AttendanceShift, startedAt: Date, endedAt: Date): Promise<boolean>;
  /** Null when the shift is gone. */
  abstract correct(shift: AttendanceShift, change: AttendanceCorrection): Promise<AttendanceShift | null>;
  /** Names of workspace members, for the export. */
  abstract memberNames(workspaceId: string, userIds: readonly string[]): Promise<Map<string, string>>;
}
