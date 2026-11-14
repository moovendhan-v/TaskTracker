import { workedMinutes, type AttendanceBreak } from '@taskflow/shared-types';

interface Shift {
  userId: string;
  startedAt: string;
  endedAt: string | null;
  breaks: readonly AttendanceBreak[];
  onBreak: boolean;
}

/** YYYY-MM-DD of an instant in the viewer's own time zone. */
export const localDate = (iso: string) => new Date(iso).toLocaleDateString('en-CA');

export interface TeamWeekRow {
  userId: string;
  /** Minutes worked per day (the day a shift started, in your time zone). */
  minutes: Record<string, number>;
  total: number;
  /** Clocked in right now, and whether on a break. */
  now: 'in' | 'break' | null;
}

/** One row per person who clocked in that week, with minutes per day. Open shifts count up to `now`. */
export function teamWeek(shifts: readonly Shift[], days: readonly string[], now: Date): TeamWeekRow[] {
  const rows = new Map<string, TeamWeekRow>();
  for (const shift of shifts) {
    const day = localDate(shift.startedAt);
    const row = rows.get(shift.userId) ?? { userId: shift.userId, minutes: {}, total: 0, now: null };
    if (days.includes(day)) {
      const worked = workedMinutes(shift, now);
      row.minutes[day] = (row.minutes[day] ?? 0) + worked;
      row.total += worked;
    }
    if (shift.endedAt === null) row.now = shift.onBreak ? 'break' : 'in';
    rows.set(shift.userId, row);
  }
  return [...rows.values()];
}

/** "7h 05m", "45m". */
export function formatWorked(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return hours ? `${hours}h ${String(rest).padStart(2, '0')}m` : `${rest}m`;
}

const pad = (value: number) => String(value).padStart(2, '0');

/** An instant as a `datetime-local` input value, in the viewer's time zone. */
export function toLocalInput(iso: string): string {
  const date = new Date(iso);
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

/** A `datetime-local` value (the viewer's time zone) as an ISO instant, or null when empty or invalid. */
export function fromLocalInput(value: string): string | null {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value)) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

export { viewerTimeZone } from '@/lib/time-zone';
