/**
 * Attendance (E4): clocking in and out of a working day, with breaks. Times are
 * always the server's clock; people can't type their own start or end.
 */
export interface AttendanceBreak {
  start: string;
  /** Null while the break is running. */
  end: string | null;
}

export const ATTENDANCE_LIMITS = {
  /** Breaks one shift can hold. */
  breaksPerShift: 10,
  /** The team view covers at most this many days at a time. */
  rangeDaysMax: 31,
  /** Your own recent shifts shown on the page. */
  recentShifts: 20,
} as const;

/** Minutes between two instants (or until `now` while still open), never negative. */
function minutesBetween(start: string, end: string | null, now: Date): number {
  const to = end ? Date.parse(end) : now.getTime();
  return Math.max(0, Math.floor((to - Date.parse(start)) / 60_000));
}

/** Minutes on break, counting a running break up to `now`. */
export function breakMinutes(breaks: readonly AttendanceBreak[], now: Date): number {
  return breaks.reduce((sum, item) => sum + minutesBetween(item.start, item.end, now), 0);
}

/** Minutes worked in a shift: its length minus its breaks. An open shift counts up to `now`. */
export function workedMinutes(shift: { startedAt: string; endedAt: string | null; breaks: readonly AttendanceBreak[] }, now: Date): number {
  return Math.max(0, minutesBetween(shift.startedAt, shift.endedAt, now) - breakMinutes(shift.breaks, now));
}
