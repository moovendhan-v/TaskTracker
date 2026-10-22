const shortDate = new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric' });
const longDate = new Intl.DateTimeFormat(undefined, { year: 'numeric', month: 'short', day: 'numeric' });

export function formatShortDate(iso: string | null | undefined): string {
  return iso ? shortDate.format(new Date(iso)) : '';
}

export function formatLongDate(iso: string | null | undefined): string {
  return iso ? longDate.format(new Date(iso)) : '';
}

/** True when the date is before today (local time). */
export function isOverdue(iso: string | null | undefined): boolean {
  if (!iso) return false;
  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);
  return new Date(iso) < startOfToday;
}

/** yyyy-mm-dd for <input type="date">. */
export function toDateInputValue(iso: string | null | undefined): string {
  return iso ? new Date(iso).toISOString().slice(0, 10) : '';
}

/** Converts a yyyy-mm-dd value to an ISO timestamp at noon UTC, so time zones don't shift the day. */
export function fromDateInputValue(value: string): string | null {
  return value ? new Date(`${value}T12:00:00.000Z`).toISOString() : null;
}
