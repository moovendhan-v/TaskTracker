export interface SnoozeOption {
  label: string;
  until: Date;
}

/** At this hour (local time) "tomorrow" and "next week" begin. */
const MORNING_HOUR = 9;

function morning(date: Date, daysAhead: number): Date {
  const next = new Date(date);
  next.setDate(next.getDate() + daysAhead);
  next.setHours(MORNING_HOUR, 0, 0, 0);
  return next;
}

/**
 * When a snoozed item can come back: in 3 hours, tomorrow morning, and next Monday morning
 * (in the viewer's own time zone). Monday from a Sunday is the next day; from a Monday, a week on.
 */
export function snoozeOptions(now: Date): SnoozeOption[] {
  const daysToMonday = ((8 - now.getDay()) % 7) || 7;
  return [
    { label: 'In 3 hours', until: new Date(now.getTime() + 3 * 3_600_000) },
    { label: 'Tomorrow morning', until: morning(now, 1) },
    { label: 'Next week', until: morning(now, daysToMonday) },
  ];
}
