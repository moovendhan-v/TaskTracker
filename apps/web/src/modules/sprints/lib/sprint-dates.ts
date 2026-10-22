const dayFormat = new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric', timeZone: 'UTC' });

/** "Nov 2 – Nov 13" from two yyyy-mm-dd strings (read as calendar days, not times). */
export function formatSprintRange(startDate: string, endDate: string): string {
  return `${dayFormat.format(new Date(`${startDate}T00:00:00Z`))} – ${dayFormat.format(new Date(`${endDate}T00:00:00Z`))}`;
}

/** Today and two weeks from today as yyyy-mm-dd, for a new sprint's defaults. */
export function defaultSprintDates(): { startDate: string; endDate: string } {
  const start = new Date();
  const end = new Date(start);
  end.setDate(end.getDate() + 13);
  const iso = (date: Date) => date.toISOString().slice(0, 10);
  return { startDate: iso(start), endDate: iso(end) };
}
