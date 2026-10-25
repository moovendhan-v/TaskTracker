/** Date windows the dashboards and time views offer. Every window is [from, to): `to` is exclusive. */
export const PERIODS = ['this_week', 'last_week', 'this_month', 'last_month', 'last_30', 'this_year'] as const;
export type Period = (typeof PERIODS)[number];

export const PERIOD_LABELS: Record<Period, string> = {
  this_week: 'This week',
  last_week: 'Last week',
  this_month: 'This month',
  last_month: 'Last month',
  last_30: 'Last 30 days',
  this_year: 'This year',
};

export interface DateWindow {
  from: Date;
  to: Date;
}

export function startOfDay(date: Date): Date {
  const copy = new Date(date);
  copy.setHours(0, 0, 0, 0);
  return copy;
}

export function addDays(date: Date, days: number): Date {
  const copy = new Date(date);
  copy.setDate(copy.getDate() + days);
  return copy;
}

/** Start of the week containing `date`; `weekStart` 0 = Sunday, 1 = Monday. */
export function startOfWeek(date: Date, weekStart: number): Date {
  const day = startOfDay(date);
  return addDays(day, -((day.getDay() - weekStart + 7) % 7));
}

export function periodWindow(period: Period, weekStart: number, now = new Date()): DateWindow {
  const today = startOfDay(now);
  switch (period) {
    case 'this_week': {
      const from = startOfWeek(today, weekStart);
      return { from, to: addDays(from, 7) };
    }
    case 'last_week': {
      const to = startOfWeek(today, weekStart);
      return { from: addDays(to, -7), to };
    }
    case 'this_month':
      return { from: new Date(today.getFullYear(), today.getMonth(), 1), to: new Date(today.getFullYear(), today.getMonth() + 1, 1) };
    case 'last_month':
      return { from: new Date(today.getFullYear(), today.getMonth() - 1, 1), to: new Date(today.getFullYear(), today.getMonth(), 1) };
    case 'last_30':
      return { from: addDays(today, -29), to: addDays(today, 1) };
    case 'this_year':
      return { from: new Date(today.getFullYear(), 0, 1), to: new Date(today.getFullYear() + 1, 0, 1) };
  }
}

/** The browser's IANA zone, which the API uses to split hours into days. */
export function localTimeZone(): string {
  return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
}

/** yyyy-mm-dd in local time. */
export function localDay(date: Date): string {
  const pad = (value: number) => String(value).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

const numeric = new Intl.DateTimeFormat('en-US', { month: '2-digit', day: '2-digit', year: '2-digit' });
const monthDay = new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric' });

/** 10/18/26 – 10/24/26 for a [from, to) window. */
export function formatWindow(window: DateWindow): string {
  return `${numeric.format(window.from)} – ${numeric.format(addDays(window.to, -1))}`;
}

export function formatMonthDay(date: Date | string): string {
  return monthDay.format(typeof date === 'string' ? new Date(date.length === 10 ? `${date}T12:00:00` : date) : date);
}

export function formatNumericDate(date: Date | string): string {
  return numeric.format(typeof date === 'string' ? new Date(date.length === 10 ? `${date}T12:00:00` : date) : date);
}
