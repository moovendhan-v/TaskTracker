import type { AttendanceBreak } from '@taskflow/shared-types';

export interface AttendanceShift {
  id: string;
  workspaceId: string;
  userId: string;
  startedAt: Date;
  endedAt: Date | null;
  breaks: AttendanceBreak[];
}

/** Clocked shifts. Writes only ever touch the caller's own rows (RLS enforces it too). */
export abstract class AttendanceRepository {
  /** The person's open shift, locked for this transaction. */
  abstract lockOpen(workspaceId: string, userId: string): Promise<AttendanceShift | null>;
  /** Null when an open shift already exists (the unique index decides, so races are safe). */
  abstract insertOpen(workspaceId: string, userId: string, startedAt: Date): Promise<AttendanceShift | null>;
  abstract save(shift: AttendanceShift): Promise<AttendanceShift>;
  abstract recent(workspaceId: string, userId: string, limit: number): Promise<AttendanceShift[]>;
  /** Everyone's shifts that overlap [from, to). */
  abstract overlapping(workspaceId: string, from: Date, to: Date, limit: number): Promise<AttendanceShift[]>;
}
