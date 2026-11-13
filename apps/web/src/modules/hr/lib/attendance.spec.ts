import { describe, expect, it } from 'vitest';
import { formatWorked, fromLocalInput, localDate, teamWeek, toLocalInput } from './attendance';

describe('attendance view helpers', () => {
  const day = (offset: number, hour: number) => new Date(2026, 10, 2 + offset, hour).toISOString();
  const days = [0, 1, 2].map((offset) => localDate(day(offset, 12)));

  it('adds up minutes per person and day, and says who is in now', () => {
    const now = new Date(2026, 10, 4, 11);
    const rows = teamWeek(
      [
        { userId: 'a', startedAt: day(0, 9), endedAt: day(0, 17), breaks: [{ start: day(0, 12), end: day(0, 13) }], onBreak: false },
        { userId: 'a', startedAt: day(2, 9), endedAt: null, breaks: [], onBreak: false },
        { userId: 'b', startedAt: day(1, 8), endedAt: day(1, 12), breaks: [], onBreak: false },
      ],
      days,
      now,
    );
    const a = rows.find((row) => row.userId === 'a')!;
    expect(a.minutes[days[0]!]).toBe(7 * 60);
    expect(a.minutes[days[2]!]).toBe(2 * 60);
    expect(a.total).toBe(9 * 60);
    expect(a.now).toBe('in');
    expect(rows.find((row) => row.userId === 'b')).toMatchObject({ total: 240, now: null });
  });

  it('formats worked time', () => {
    expect(formatWorked(425)).toBe('7h 05m');
    expect(formatWorked(45)).toBe('45m');
  });

  it('round-trips datetime-local values in your time zone', () => {
    const iso = new Date(2026, 10, 10, 8, 5).toISOString();
    expect(toLocalInput(iso)).toBe('2026-11-10T08:05');
    expect(fromLocalInput('2026-11-10T08:05')).toBe(iso);
    expect(fromLocalInput('')).toBeNull();
    expect(fromLocalInput('yesterday')).toBeNull();
  });
});
