/** Limits for time tracking, shared so the web app shows the same rules the API enforces. */
export const TIME_LIMITS = {
  /** One entry covers at most a day. */
  entryMinutesMax: 24 * 60,
  noteMax: 1000,
  activityMax: 40,
  /** Daily log saves at most this many entries at once. */
  batchMax: 24,
  /** Reports and timesheets cover at most this many days. */
  rangeDaysMax: 400,
  /** Entries returned by one listing. */
  listMax: 1000,
} as const;

/** Whole minutes between two instants, rounded to the nearest minute. */
export function minutesBetween(startedAt: Date, endedAt: Date): number {
  return Math.round((endedAt.getTime() - startedAt.getTime()) / 60_000);
}

/** "1 h 30 m", "45 m", "0 m". */
export function formatMinutes(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  if (hours === 0) return `${rest} m`;
  return rest === 0 ? `${hours} h` : `${hours} h ${rest} m`;
}
