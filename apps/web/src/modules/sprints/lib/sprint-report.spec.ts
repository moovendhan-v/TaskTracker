import { describe, expect, it } from 'vitest';
import type { SprintReportResponse } from '@taskflow/shared-types';
import { deliveredPercent, formatTotals, reportText, reportUnit } from './sprint-report';

const report = (overrides: Partial<SprintReportResponse> = {}): SprintReportResponse => ({
  sprintId: 's',
  name: 'Sprint 7',
  goal: 'Ship login',
  status: 'completed',
  startDate: '2026-11-02',
  endDate: '2026-11-13',
  startedAt: null,
  completedAt: null,
  hasStartSnapshot: true,
  committed: { tasks: 4, points: 18 },
  completed: { tasks: 2, points: 9 },
  cancelled: { tasks: 0, points: 0 },
  notCompleted: { tasks: 2, points: 7 },
  added: { tasks: 1, points: 0 },
  removed: { tasks: 1, points: 8 },
  unestimated: 1,
  items: [
    { taskId: 'a', number: 1, title: 'Login form', points: 5, outcome: 'done', added: false, removed: false, movedTo: null },
    { taskId: 'b', number: 2, title: 'Login API', points: 5, outcome: 'open', added: false, removed: false, movedTo: 'Sprint 8' },
    { taskId: 'c', number: 4, title: 'Spike', points: 8, outcome: 'open', added: false, removed: true, movedTo: null },
  ],
  ...overrides,
});

describe('sprint report helpers', () => {
  it('speaks in points when the sprint used them, else in tasks', () => {
    expect(reportUnit(report())).toBe('points');
    const zero = { tasks: 3, points: 0 };
    expect(reportUnit(report({ committed: zero, completed: zero, added: zero, removed: zero, notCompleted: zero }))).toBe('tasks');
    expect(formatTotals({ tasks: 1, points: 1 }, 'points')).toBe('1 pt');
    expect(formatTotals({ tasks: 1, points: 1 }, 'tasks')).toBe('1 task');
    expect(deliveredPercent(report(), 'points')).toBe(50);
    expect(deliveredPercent(report({ committed: { tasks: 0, points: 0 } }), 'points')).toBe(0);
  });

  it('writes a plain-text summary with the unfinished work and where it went', () => {
    expect(reportText(report())).toBe(
      [
        'Sprint 7 (2026-11-02 – 2026-11-13)',
        'Goal: Ship login',
        'Committed: 18 pts · Done: 9 pts (50%)',
        'Added mid-sprint: 0 pts · Removed: 8 pts · Not done: 7 pts',
        '',
        'Not done:',
        '- #2 Login API → Sprint 8',
      ].join('\n'),
    );
  });
});
