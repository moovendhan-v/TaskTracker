import { Injectable } from '@nestjs/common';
import { ATTENDANCE_LIMITS, workedMinutes, type AttendanceShiftResponse, type MyAttendanceResponse } from '@taskflow/shared-types';
import { DomainError } from '../../../../core/domain/domain-error.js';
import { Clock } from '../../../../core/time/clock.port.js';
import { AttendanceRepository, type AttendanceShift } from '../domain/attendance.repository.js';

/** Shifts the team view returns at most (the query complexity cap matches); the page asks for a week at a time. */
const TEAM_SHIFTS_MAX = 500;

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
    const start = Date.parse(from);
    const end = Date.parse(to);
    if (Number.isNaN(start) || Number.isNaN(end)) throw DomainError.invalid('from and to must be dates');
    if (end <= start) throw DomainError.invalid('The range must end after it starts');
    if ((end - start) / 86_400_000 > ATTENDANCE_LIMITS.rangeDaysMax) throw DomainError.invalid(`At most ${ATTENDANCE_LIMITS.rangeDaysMax} days at a time`);
    return (await this.shifts.overlapping(workspaceId, new Date(start), new Date(end), TEAM_SHIFTS_MAX)).map((shift) => this.toResponse(shift));
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
