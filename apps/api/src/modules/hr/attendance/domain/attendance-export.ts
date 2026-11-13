import { breakMinutes, workedMinutes, type AttendanceBreak } from '@taskflow/shared-types';

export interface ExportShift {
  userId: string;
  startedAt: Date;
  endedAt: Date | null;
  breaks: AttendanceBreak[];
  correctionReason: string | null;
}

export const ATTENDANCE_CSV_HEADER = ['Person', 'Date', 'Clock in', 'Clock out', 'Breaks (min)', 'Worked', 'Worked (min)', 'Corrected'] as const;

/** An IANA time zone name the runtime knows, e.g. Europe/Berlin. */
export function isTimeZone(value: string): boolean {
  if (value.length > 64 || !/^[A-Za-z0-9_+\-/]+$/.test(value)) return false;
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: value });
    return true;
  } catch {
    return false;
  }
}

/** Quotes a cell and defuses spreadsheet formulas (=, +, -, @, tab or CR at the start). */
export function csvCell(value: string | number): string {
  let text = String(value);
  if (/^[=+\-@\t\r]/.test(text)) text = `'${text}`;
  return `"${text.replace(/"/g, '""')}"`;
}

function parts(date: Date, timeZone: string): { day: string; time: string } {
  const values = Object.fromEntries(
    new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' })
      .formatToParts(date)
      .map((part) => [part.type, part.value]),
  );
  return { day: `${values['year']}-${values['month']}-${values['day']}`, time: `${values['hour']}:${values['minute']}` };
}

const hoursAndMinutes = (minutes: number) => `${Math.floor(minutes / 60)}:${String(minutes % 60).padStart(2, '0')}`;

/**
 * The team's shifts as CSV, one row per shift in the viewer's time zone. A
 * clock-out on a later day carries its date; an open shift has no clock-out and
 * counts up to `now`. Starts with a byte order mark so spreadsheets read UTF-8.
 */
export function formatAttendanceCsv(shifts: readonly ExportShift[], names: ReadonlyMap<string, string>, timeZone: string, now: Date): string {
  const rows = shifts.map((shift) => {
    const start = parts(shift.startedAt, timeZone);
    const end = shift.endedAt ? parts(shift.endedAt, timeZone) : null;
    const startedAt = shift.startedAt.toISOString();
    const endedAt = shift.endedAt?.toISOString() ?? null;
    const worked = workedMinutes({ startedAt, endedAt, breaks: shift.breaks }, now);
    return [
      names.get(shift.userId) ?? 'Former member',
      start.day,
      start.time,
      end ? (end.day === start.day ? end.time : `${end.day} ${end.time}`) : '',
      breakMinutes(shift.breaks, now),
      hoursAndMinutes(worked),
      worked,
      shift.correctionReason ?? '',
    ];
  });
  return String.fromCharCode(0xfeff) + [ATTENDANCE_CSV_HEADER, ...rows].map((row) => row.map(csvCell).join(',')).join('\r\n') + '\r\n';
}
