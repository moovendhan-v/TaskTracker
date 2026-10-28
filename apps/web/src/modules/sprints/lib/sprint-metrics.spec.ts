import { describe, expect, it } from 'vitest';
import type { StatusCategory } from '@taskflow/shared-types';
import { burndown, formatMinutes, sprintTiming, summarize, workload } from './sprint-metrics';

const task = (category: StatusCategory, extra: { completedAt?: string | null; estimateMinutes?: number | null; assigneeId?: string | null } = {}) => ({
  status: { id: category, spaceId: 's', name: category, color: '#000000', category, position: 0 },
  completedAt: extra.completedAt ?? null,
  estimateMinutes: extra.estimateMinutes ?? null,
  assigneeId: extra.assigneeId ?? null,
});

describe('sprint metrics', () => {
  const sprint = { startDate: '2026-11-02', endDate: '2026-11-06' };

  it('measures time in calendar days, both ends included', () => {
    expect(sprintTiming(sprint, '2026-11-01')).toMatchObject({ totalDays: 5, elapsedDays: 0, daysLeft: 5 });
    expect(sprintTiming(sprint, '2026-11-04')).toMatchObject({ elapsedDays: 3, daysLeft: 2, elapsedPercent: 60 });
    expect(sprintTiming(sprint, '2026-12-01')).toMatchObject({ elapsedDays: 5, daysLeft: 0, elapsedPercent: 100 });
  });

  it('burns down by completion day, with an ideal line and nothing for days ahead', () => {
    const tasks = [task('done', { completedAt: '2026-11-03T10:00:00' }), task('started'), task('unstarted'), task('done', { completedAt: '2026-11-04T09:00:00' })];
    const points = burndown(sprint, tasks, '2026-11-04');
    expect(points.map((point) => point.remaining)).toEqual([4, 3, 2, null, null]);
    expect(points.map((point) => point.ideal)).toEqual([4, 3, 2, 1, 0]);
  });

  it('summarizes progress and estimates', () => {
    const summary = summarize([task('done', { estimateMinutes: 60 }), task('review', { estimateMinutes: 30 }), task('blocked'), task('unstarted')]);
    expect(summary).toMatchObject({ total: 4, done: 1, inProgress: 1, blocked: 1, notStarted: 1, estimateMinutes: 90, doneEstimateMinutes: 60, donePercent: 25 });
  });

  it('ranks open work per person', () => {
    expect(workload([task('started', { assigneeId: 'a' }), task('unstarted', { assigneeId: 'b' }), task('unstarted', { assigneeId: 'b', estimateMinutes: 30 }), task('done', { assigneeId: 'a' })])).toEqual([
      { assigneeId: 'b', open: 2, estimateMinutes: 30 },
      { assigneeId: 'a', open: 1, estimateMinutes: 0 },
    ]);
    expect(formatMinutes(390)).toBe('6 h 30 m');
  });
});
