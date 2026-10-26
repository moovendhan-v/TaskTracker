import { formatMinutes } from '@taskflow/shared-types';

export { formatMinutes };

/** "6.5 h" — hours with at most one decimal, for compact totals. */
export function formatHours(minutes: number): string {
  const hours = Math.round((minutes / 60) * 10) / 10;
  return `${hours} h`;
}

/** HH:MM (24 h) of a local date. */
export function clock(date: Date): string {
  return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
}

/** A local day (yyyy-mm-dd) and clock time (HH:MM) as an ISO instant. */
export function instant(day: string, time: string): string {
  return new Date(`${day}T${time}:00`).toISOString();
}

export function addMinutes(time: string, minutes: number): string {
  const [hours = 0, mins = 0] = time.split(':').map(Number);
  const total = Math.min(23 * 60 + 59, Math.max(0, hours * 60 + mins + minutes));
  return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`;
}

export function minutesOfClock(time: string): number {
  const [hours = 0, mins = 0] = time.split(':').map(Number);
  return hours * 60 + mins;
}
