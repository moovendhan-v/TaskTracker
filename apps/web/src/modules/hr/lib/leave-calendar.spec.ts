import { describe, expect, it } from 'vitest';
import { awayByDay, monthGrid } from './leave-calendar';

describe('leave calendar', () => {
  it('lays a month out in whole weeks from the chosen first day', () => {
    // November 2026 starts on a Sunday and has 30 days.
    const monday = monthGrid(2026, 10, 1);
    expect(monday[0]![0]).toEqual({ date: '2026-10-26', inMonth: false });
    expect(monday[0]![6]).toEqual({ date: '2026-11-01', inMonth: true });
    expect(monday.at(-1)!.at(-1)).toEqual({ date: '2026-12-06', inMonth: false });
    expect(monday.every((week) => week.length === 7)).toBe(true);
    const sunday = monthGrid(2026, 10, 0);
    expect(sunday[0]![0]).toEqual({ date: '2026-11-01', inMonth: true });
    expect(sunday).toHaveLength(5);
  });

  it('lists who is away each day, by name', () => {
    const weeks = monthGrid(2026, 10, 1);
    const names: Record<string, string> = { a: 'Kai', b: 'Avery' };
    const away = awayByDay(weeks, [{ userId: 'a', startDate: '2026-11-03', endDate: '2026-11-05' }, { userId: 'b', startDate: '2026-11-05', endDate: '2026-11-05' }], (id) => names[id]!);
    expect(away.get('2026-11-02')).toBeUndefined();
    expect(away.get('2026-11-03')).toEqual(['Kai']);
    expect(away.get('2026-11-05')).toEqual(['Avery', 'Kai']);
  });
});
