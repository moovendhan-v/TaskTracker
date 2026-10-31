import type { StatusCategory } from '@taskflow/shared-types';
import { describe, expect, it } from 'vitest';
import { capacityByPerson, workingDays } from './capacity';

const sprint = { startDate: '2026-11-02', endDate: '2026-11-13' }; // Mon → Fri, two weeks
const task = (assignees: string[], estimateMinutes: number | null, category: StatusCategory = 'unstarted') => ({
  assigneeId: assignees[0] ?? null,
  assigneeIds: assignees,
  estimateMinutes,
  status: { category } as never,
});

describe('capacity', () => {
  it('counts weekdays only', () => {
    expect(workingDays('2026-11-02', '2026-11-13')).toBe(10);
    expect(workingDays('2026-11-07', '2026-11-08')).toBe(0);
  });

  it('subtracts leave inside the sprint and compares with planned estimates', () => {
    const rows = capacityByPerson(sprint, [task(['ana'], 600), task(['ana'], null), task(['ben'], 1200), task(['ben'], 600, 'done')], [
      { userId: 'ana', startDate: '2026-10-30', endDate: '2026-11-04' }, // Fri → Wed: 3 working days fall in the sprint
    ]);
    const ana = rows.find((row) => row.userId === 'ana')!;
    expect(ana).toMatchObject({ workDays: 10, leaveDays: 3, availableHours: 42, plannedHours: 10, openTasks: 2, unestimated: 1 });
    const ben = rows.find((row) => row.userId === 'ben')!;
    expect(ben).toMatchObject({ leaveDays: 0, availableHours: 60, plannedHours: 20, openTasks: 1 });
    expect(rows.map((row) => row.userId)).toEqual(['ben', 'ana']); // most loaded first
  });

  it('splits shared tasks and handles people with no time left', () => {
    const rows = capacityByPerson(sprint, [task(['ana', 'ben'], 600)], [{ userId: 'ben', startDate: '2026-11-01', endDate: '2026-11-20' }]);
    expect(rows.find((row) => row.userId === 'ana')?.plannedHours).toBe(5);
    expect(rows.find((row) => row.userId === 'ben')).toMatchObject({ availableHours: 0, load: null });
  });
});
