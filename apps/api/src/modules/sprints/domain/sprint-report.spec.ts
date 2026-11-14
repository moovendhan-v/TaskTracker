import { describe, expect, it } from 'vitest';
import type { SprintWithCounts } from './sprint.js';
import { buildSprintReport, type SprintTaskRow } from './sprint-report.js';

const sprint = (overrides: Partial<SprintWithCounts> = {}): SprintWithCounts => ({
  id: 's1',
  workspaceId: 'w',
  spaceId: 'space',
  name: 'Sprint 1',
  goal: 'Ship login',
  startDate: '2026-11-02',
  endDate: '2026-11-13',
  status: 'completed',
  completedAt: new Date('2026-11-13T17:00:00Z'),
  committedTasks: 4,
  committedPoints: 13,
  startedAt: new Date('2026-11-02T09:00:00Z'),
  createdAt: new Date(),
  updatedAt: new Date(),
  totalTasks: 2,
  totalPoints: 8,
  doneTasks: 2,
  donePoints: 8,
  ...overrides,
});
const row = (taskId: string, number: number, points: number | null, statusCategory = 'started', destination: string | null = null): SprintTaskRow => ({ taskId, number, title: `Task ${number}`, points, statusCategory, destination });

describe('buildSprintReport', () => {
  it('compares what was committed with what was done, added, removed and moved', () => {
    const start = [row('a', 1, 5), row('b', 2, 3), row('c', 3, 2), row('gone', 4, 8)];
    const end = [row('a', 1, 5, 'done'), row('b', 2, 3, 'started', 's2'), row('c', 3, 2, 'cancelled'), row('new', 5, null, 'done'), row('late', 6, 3, 'unstarted', 'backlog')];
    const report = buildSprintReport(sprint(), start, end, (id) => (id === 's2' ? 'Sprint 2' : null));

    expect(report.committed).toEqual({ tasks: 4, points: 18 });
    expect(report.completed).toEqual({ tasks: 2, points: 5 });
    expect(report.cancelled).toEqual({ tasks: 1, points: 2 });
    expect(report.notCompleted).toEqual({ tasks: 2, points: 6 });
    expect(report.added).toEqual({ tasks: 2, points: 3 });
    expect(report.removed).toEqual({ tasks: 1, points: 8 });
    expect(report.unestimated).toBe(1);
    expect(report.items.map((item) => [item.number, item.outcome, item.added, item.removed, item.movedTo])).toEqual([
      [1, 'done', false, false, null],
      [2, 'open', false, false, 'Sprint 2'],
      [3, 'cancelled', false, false, null],
      [4, 'open', false, true, null],
      [5, 'done', true, false, null],
      [6, 'open', true, false, 'Backlog'],
    ]);
  });

  it('falls back to what the sprint held at completion when it has no start snapshot', () => {
    const report = buildSprintReport(sprint({ startedAt: null }), null, [row('a', 1, 5, 'done'), row('b', 2, 3, 'done')], () => null);
    expect(report.hasStartSnapshot).toBe(false);
    expect(report.committed).toEqual({ tasks: 4, points: 13 });
    expect(report.completed).toEqual({ tasks: 2, points: 8 });
    expect(report.items.every((item) => !item.added)).toBe(true);
  });

  it('reports a running sprint live', () => {
    const report = buildSprintReport(sprint({ status: 'active', completedAt: null, committedTasks: null, committedPoints: null }), [row('a', 1, 5)], [row('a', 1, 5, 'review'), row('b', 2, 2)], () => null);
    expect(report).toMatchObject({ status: 'active', completedAt: null, committed: { tasks: 1, points: 5 }, added: { tasks: 1, points: 2 }, notCompleted: { tasks: 2, points: 7 } });
  });
});
