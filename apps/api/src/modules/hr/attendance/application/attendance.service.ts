import { Injectable } from '@nestjs/common';
import {
  ATTENDANCE_LIMITS,
  clipBreaks,
  workedMinutes,
  type AttendanceExportResponse,
  type AttendanceShiftResponse,
  type CorrectAttendanceShiftInput,
  type MyAttendanceResponse,
} from '@taskflow/shared-types';
import { AuditLogger } from '../../../../core/audit/audit-logger.port.js';
import { TransactionalManager } from '../../../../core/database/transactional-manager.js';
import { DomainError } from '../../../../core/domain/domain-error.js';
import type { Actor } from '../../../../core/http/types/authenticated-request.js';
import { Clock } from '../../../../core/time/clock.port.js';
import { formatAttendanceCsv, isTimeZone } from '../domain/attendance-export.js';
import { AttendanceRepository, type AttendanceShift } from '../domain/attendance.repository.js';

/** Shifts the team view returns at most (the query complexity cap matches); the page asks for a week at a time. */
const TEAM_SHIFTS_MAX = 400;

/**
 * Clock in, take breaks, clock out: always as the signed-in person, always at
 * the server's time. Each change locks the open shift, so double clicks and
 * two tabs can't tangle it.
 */
@Injectable()
export class AttendanceService {
  constructor(
    private readonly shifts: AttendanceRepository,
    private readonly clock: Clock,
    private readonly transactional: TransactionalManager,
    private readonly auditLogger: AuditLogger,
  ) {}

  toResponse(shift: AttendanceShift): AttendanceShiftResponse {
    const breaks = shift.breaks;
    const startedAt = shift.startedAt.toISOString();
    const endedAt = shift.endedAt?.toISOString() ?? null;
    return {
      id: shift.id,
      userId: shift.userId,
      startedAt,
      endedAt,
      breaks,
      onBreak: endedAt === null && breaks.some((item) => item.end === null),
      workedMinutes: workedMinutes({ startedAt, endedAt, breaks }, this.clock.now()),
      correctedAt: shift.correction?.at.toISOString() ?? null,
      correctedById: shift.correction?.byId ?? null,
      correctionReason: shift.correction?.reason ?? null,
    };
  }

  async mine(workspaceId: string, userId: string): Promise<MyAttendanceResponse> {
    const recent = await this.shifts.recent(workspaceId, userId, ATTENDANCE_LIMITS.recentShifts);
    const current = recent.find((shift) => shift.endedAt === null) ?? null;
    return { current: current ? this.toResponse(current) : null, recent: recent.map((shift) => this.toResponse(shift)) };
  }

  async clockIn(workspaceId: string, userId: string): Promise<AttendanceShiftResponse> {
    const shift = await this.shifts.insertOpen(workspaceId, userId, this.clock.now());
    if (!shift) throw DomainError.conflict('You’re already clocked in');
    return this.toResponse(shift);
  }

  async startBreak(workspaceId: string, userId: string): Promise<AttendanceShiftResponse> {
    const shift = await this.open(workspaceId, userId);
    if (shift.breaks.some((item) => item.end === null)) throw DomainError.conflict('You’re already on a break');
    if (shift.breaks.length >= ATTENDANCE_LIMITS.breaksPerShift) throw DomainError.invalid(`A shift can have at most ${ATTENDANCE_LIMITS.breaksPerShift} breaks`);
    return this.toResponse(await this.shifts.save({ ...shift, breaks: [...shift.breaks, { start: this.clock.now().toISOString(), end: null }] }));
  }

  async endBreak(workspaceId: string, userId: string): Promise<AttendanceShiftResponse> {
    const shift = await this.open(workspaceId, userId);
    if (!shift.breaks.some((item) => item.end === null)) throw DomainError.conflict('You’re not on a break');
    return this.toResponse(await this.shifts.save({ ...shift, breaks: this.endRunningBreak(shift) }));
  }

  /** Ends the shift, and a running break with it. */
  async clockOut(workspaceId: string, userId: string): Promise<AttendanceShiftResponse> {
    const shift = await this.open(workspaceId, userId);
    return this.toResponse(await this.shifts.save({ ...shift, breaks: this.endRunningBreak(shift), endedAt: this.clock.now() }));
  }

  /** Everyone's shifts overlapping the range (needs hr.manage; the resolver checks). */
  async team(workspaceId: string, from: string, to: string): Promise<AttendanceShiftResponse[]> {
    const range = this.range(from, to);
    return (await this.shifts.overlapping(workspaceId, range.start, range.end, TEAM_SHIFTS_MAX)).map((shift) => this.toResponse(shift));
  }

  /**
   * Everyone's shifts in the range as CSV, in the viewer's time zone (needs
   * hr.manage; the resolver checks). Audited: it's personal data leaving the app.
   */
  async exportCsv(actor: Actor, workspaceId: string, from: string, to: string, timeZone: string): Promise<AttendanceExportResponse> {
    if (!isTimeZone(timeZone)) throw DomainError.invalid('Unknown time zone');
    const range = this.range(from, to);
    const found = await this.shifts.overlapping(workspaceId, range.start, range.end, ATTENDANCE_LIMITS.exportShiftsMax + 1);
    const truncated = found.length > ATTENDANCE_LIMITS.exportShiftsMax;
    const shifts = found.slice(0, ATTENDANCE_LIMITS.exportShiftsMax);
    const names = await this.shifts.memberNames(workspaceId, [...new Set(shifts.map((shift) => shift.userId))]);
    const content = formatAttendanceCsv(
      shifts.map((shift) => ({ ...shift, correctionReason: shift.correction?.reason ?? null })),
      names,
      timeZone,
      this.clock.now(),
    );
    await this.auditLogger.record(actor, { action: 'attendance.export', targetType: 'attendance', workspaceId, metadata: { from: range.start.toISOString(), to: range.end.toISOString(), shifts: shifts.length, truncated } });
    return { fileName: `attendance-${from.slice(0, 10)}-to-${to.slice(0, 10)}.csv`, content, shifts: shifts.length, truncated };
  }

  /**
   * HR fixes a shift's times (needs hr.manage; the resolver checks): a forgotten
   * clock-out, a wrong start. Breaks are kept inside the new times, the person
   * can't end up with overlapping shifts, and nothing lands in the future. The
   * shift shows it was corrected and why; the audit log keeps before and after.
   */
  async correct(actor: Actor, workspaceId: string, shiftId: string, input: CorrectAttendanceShiftInput): Promise<AttendanceShiftResponse> {
    const reason = input.reason.trim();
    if (!reason) throw DomainError.invalid('Say why the shift is being corrected');
    if (reason.length > ATTENDANCE_LIMITS.correctionReasonMax) throw DomainError.invalid(`The reason can be at most ${ATTENDANCE_LIMITS.correctionReasonMax} characters`);
    const startedAt = new Date(Date.parse(input.startedAt));
    const endedAt = new Date(Date.parse(input.endedAt));
    if (Number.isNaN(startedAt.getTime()) || Number.isNaN(endedAt.getTime())) throw DomainError.invalid('Start and end must be dates');
    if (endedAt <= startedAt) throw DomainError.invalid('The shift must end after it starts');
    if (endedAt.getTime() - startedAt.getTime() > ATTENDANCE_LIMITS.shiftHoursMax * 3_600_000) throw DomainError.invalid(`A shift can be at most ${ATTENDANCE_LIMITS.shiftHoursMax} hours`);
    const now = this.clock.now();
    if (endedAt > now) throw DomainError.invalid('A corrected shift can’t end in the future');

    const shift = await this.shifts.find(workspaceId, shiftId);
    if (!shift) throw DomainError.notFound('Shift');
    if (await this.shifts.overlapsAnother(shift, startedAt, endedAt)) throw DomainError.conflict('That overlaps another of their shifts');
    const breaks = clipBreaks(shift.breaks, startedAt.toISOString(), endedAt.toISOString());
    // RLS lets people write only their own shifts; HR's right was checked above
    // (hr.manage), so this one update runs in platform scope, still naming the workspace.
    const saved = await this.transactional.runInScope({ kind: 'platform' }, () =>
      this.shifts.correct(shift, { startedAt, endedAt, breaks, byId: actor.userId, at: now, reason }),
    );
    if (!saved) throw DomainError.notFound('Shift');
    await this.auditLogger.record(actor, {
      action: 'attendance.correct',
      targetType: 'attendance_shift',
      targetId: shift.id,
      workspaceId,
      metadata: {
        userId: shift.userId,
        before: { startedAt: shift.startedAt.toISOString(), endedAt: shift.endedAt?.toISOString() ?? null, breaks: shift.breaks.length },
        after: { startedAt: startedAt.toISOString(), endedAt: endedAt.toISOString(), breaks: breaks.length },
        reason,
      },
    });
    return this.toResponse(saved);
  }

  private range(from: string, to: string): { start: Date; end: Date } {
    const start = Date.parse(from);
    const end = Date.parse(to);
    if (Number.isNaN(start) || Number.isNaN(end)) throw DomainError.invalid('from and to must be dates');
    if (end <= start) throw DomainError.invalid('The range must end after it starts');
    if ((end - start) / 86_400_000 > ATTENDANCE_LIMITS.rangeDaysMax) throw DomainError.invalid(`At most ${ATTENDANCE_LIMITS.rangeDaysMax} days at a time`);
    return { start: new Date(start), end: new Date(end) };
  }

  private async open(workspaceId: string, userId: string): Promise<AttendanceShift> {
    const shift = await this.shifts.lockOpen(workspaceId, userId);
    if (!shift) throw DomainError.conflict('You’re not clocked in');
    return shift;
  }

  private endRunningBreak(shift: AttendanceShift) {
    const now = this.clock.now().toISOString();
    return shift.breaks.map((item) => (item.end === null ? { ...item, end: now } : item));
  }
}
