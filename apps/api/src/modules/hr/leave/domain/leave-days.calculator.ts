const DAY_MS = 86_400_000;

/**
 * Working days (Monday to Friday) from start to end, both included.
 * Dates are yyyy-mm-dd calendar days and are read in UTC, so time zones can't shift them.
 */
export function countWorkingDays(startDate: string, endDate: string): number {
  const start = Date.parse(`${startDate}T00:00:00Z`);
  const end = Date.parse(`${endDate}T00:00:00Z`);
  if (Number.isNaN(start) || Number.isNaN(end) || end < start) return 0;

  const totalDays = Math.round((end - start) / DAY_MS) + 1;
  const fullWeeks = Math.floor(totalDays / 7);
  let workingDays = fullWeeks * 5;
  const startWeekday = new Date(start).getUTCDay();
  for (let offset = 0; offset < totalDays % 7; offset += 1) {
    const weekday = (startWeekday + offset) % 7;
    if (weekday !== 0 && weekday !== 6) workingDays += 1;
  }
  return workingDays;
}
