/** Calendar dates as YYYY-MM-DD strings, worked out in UTC so no time zone shifts a day. */
const iso = (date: Date) => date.toISOString().slice(0, 10);

export interface CalendarDay {
  date: string;
  /** False for the days of the previous and next month that fill the first and last weeks. */
  inMonth: boolean;
}

/** The weeks of a month, each starting on `weekStart` (0 = Sunday, 1 = Monday, …). Always whole weeks. */
export function monthGrid(year: number, month: number, weekStart: number): CalendarDay[][] {
  const first = new Date(Date.UTC(year, month, 1));
  const start = new Date(first);
  start.setUTCDate(1 - ((first.getUTCDay() - weekStart + 7) % 7));
  const last = new Date(Date.UTC(year, month + 1, 0));
  const weeks: CalendarDay[][] = [];
  for (const day = new Date(start); day <= last || weeks.length === 0 || weeks[weeks.length - 1]!.length < 7; ) {
    if (weeks.length === 0 || weeks[weeks.length - 1]!.length === 7) weeks.push([]);
    weeks[weeks.length - 1]!.push({ date: iso(day), inMonth: day.getUTCMonth() === month });
    day.setUTCDate(day.getUTCDate() + 1);
  }
  return weeks;
}

export interface Absence {
  userId: string;
  startDate: string;
  endDate: string;
}

/** Who is away on each date of the grid, in a stable order (by name). */
export function awayByDay(weeks: readonly CalendarDay[][], absences: readonly Absence[], nameOf: (userId: string) => string): Map<string, string[]> {
  const byDay = new Map<string, string[]>();
  for (const week of weeks) {
    for (const { date } of week) {
      const people = [...new Set(absences.filter((absence) => absence.startDate <= date && date <= absence.endDate).map((absence) => absence.userId))];
      if (people.length) byDay.set(date, people.map(nameOf).sort((a, b) => a.localeCompare(b)));
    }
  }
  return byDay;
}
