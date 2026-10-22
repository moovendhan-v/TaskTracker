/**
 * Working days (Mon–Fri) between two yyyy-mm-dd dates, inclusive. Used only to
 * preview a request; the API counts again and its number is the one saved.
 */
export function previewWorkingDays(startDate: string, endDate: string): number {
  const start = Date.parse(`${startDate}T00:00:00Z`);
  const end = Date.parse(`${endDate}T00:00:00Z`);
  if (Number.isNaN(start) || Number.isNaN(end) || end < start) return 0;
  let days = 0;
  for (let time = start; time <= end && days <= 366; time += 86_400_000) {
    const weekday = new Date(time).getUTCDay();
    if (weekday !== 0 && weekday !== 6) days += 1;
  }
  return days;
}
