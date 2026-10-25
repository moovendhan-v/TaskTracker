import { describe, expect, it } from 'vitest';
import { daysBetween, shiftDay, startOfWeekDay, taskSpan, weekday } from './days';

describe('days', () => {
  it('shifts across months and years', () => {
    expect(shiftDay('2026-12-30', 3)).toBe('2027-01-02');
    expect(daysBetween('2026-10-19', '2026-10-23')).toBe(4);
  });

  it('finds the start of the week for either first weekday', () => {
    expect(weekday('2026-10-24')).toBe(6);
    expect(startOfWeekDay('2026-10-24', 0)).toBe('2026-10-18');
    expect(startOfWeekDay('2026-10-24', 1)).toBe('2026-10-19');
  });

  it('spans a task from start to due, or one day when only one is set', () => {
    expect(taskSpan({ startDate: '2026-10-19T12:00:00.000Z', dueDate: '2026-10-23T12:00:00.000Z' })).toEqual({ start: '2026-10-19', end: '2026-10-23' });
    expect(taskSpan({ startDate: null, dueDate: '2026-10-23T12:00:00.000Z' })).toEqual({ start: '2026-10-23', end: '2026-10-23' });
    expect(taskSpan({ startDate: null, dueDate: null })).toBeNull();
  });
});
