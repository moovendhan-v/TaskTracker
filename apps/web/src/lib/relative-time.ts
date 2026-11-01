const units: [Intl.RelativeTimeFormatUnit, number][] = [
  ['year', 365 * 24 * 60],
  ['month', 30 * 24 * 60],
  ['week', 7 * 24 * 60],
  ['day', 24 * 60],
  ['hour', 60],
  ['minute', 1],
];
const format = new Intl.RelativeTimeFormat('en', { numeric: 'auto' });

/** "now", "8 min ago", "yesterday", "3 days ago"… */
export function timeAgo(iso: string, now: Date = new Date()): string {
  const minutes = Math.round((now.getTime() - new Date(iso).getTime()) / 60_000);
  if (minutes < 1) return 'now';
  for (const [unit, size] of units) {
    if (minutes >= size) return format.format(-Math.floor(minutes / size), unit).replace(' minutes', ' min').replace(' minute', ' min');
  }
  return 'now';
}

export type DayGroup = 'Today' | 'Yesterday' | 'Earlier';

/** Which heading an item falls under, by the reader's calendar day. */
export function dayGroup(iso: string, now: Date = new Date()): DayGroup {
  const day = (date: Date) => new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
  const diff = Math.round((day(now) - day(new Date(iso))) / 86_400_000);
  return diff <= 0 ? 'Today' : diff === 1 ? 'Yesterday' : 'Earlier';
}
