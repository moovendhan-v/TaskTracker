/**
 * Calendar-day arithmetic on yyyy-mm-dd strings. Task dates are stored as noon
 * UTC on their day, so their first ten characters are the calendar day in any
 * time zone, and day maths never shifts across midnight.
 */
export type Day = string;

const MS_PER_DAY = 86_400_000;

export function dayOf(iso: string | null | undefined): Day | null {
  return iso ? iso.slice(0, 10) : null;
}

export function dayNumber(day: Day): number {
  return Date.UTC(Number(day.slice(0, 4)), Number(day.slice(5, 7)) - 1, Number(day.slice(8, 10))) / MS_PER_DAY;
}

export function dayFromNumber(value: number): Day {
  return new Date(value * MS_PER_DAY).toISOString().slice(0, 10);
}

export function shiftDay(day: Day, days: number): Day {
  return dayFromNumber(dayNumber(day) + days);
}

export function daysBetween(from: Day, to: Day): number {
  return dayNumber(to) - dayNumber(from);
}

/** The ISO timestamp a task date is stored as. */
export function dayToIso(day: Day): string {
  return `${day}T12:00:00.000Z`;
}

/** Today in the browser's time zone. */
export function today(): Day {
  const now = new Date();
  const pad = (value: number) => String(value).padStart(2, '0');
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

/** 0 = Sunday … 6 = Saturday. */
export function weekday(day: Day): number {
  return new Date(dayNumber(day) * MS_PER_DAY).getUTCDay();
}

export function startOfWeekDay(day: Day, weekStart: number): Day {
  return shiftDay(day, -((weekday(day) - weekStart + 7) % 7));
}

const labels = {
  weekday: new Intl.DateTimeFormat(undefined, { weekday: 'short', timeZone: 'UTC' }),
  monthDay: new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric', timeZone: 'UTC' }),
  month: new Intl.DateTimeFormat(undefined, { month: 'long', year: 'numeric', timeZone: 'UTC' }),
};

export function formatDay(day: Day, style: keyof typeof labels): string {
  return labels[style].format(new Date(dayNumber(day) * MS_PER_DAY));
}

/** The task's span in days: start→due, or a single day when only one is set. */
export function taskSpan(task: { startDate: string | null; dueDate: string | null }): { start: Day; end: Day } | null {
  const start = dayOf(task.startDate) ?? dayOf(task.dueDate);
  const end = dayOf(task.dueDate) ?? start;
  if (!start || !end) return null;
  return dayNumber(end) < dayNumber(start) ? { start: end, end: start } : { start, end };
}
