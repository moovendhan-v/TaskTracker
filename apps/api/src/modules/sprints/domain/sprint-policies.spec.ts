import { describe, expect, it } from 'vitest';
import type { Sprint } from './sprint.js';
import { SprintLifecyclePolicy } from './sprint-lifecycle.policy.js';
import { SprintRolloverPolicy } from './sprint-rollover.policy.js';

const sprint = (overrides: Partial<Sprint> = {}): Sprint => ({
  id: 's1',
  workspaceId: 'w',
  spaceId: 'space-a',
  name: 'Sprint 1',
  goal: '',
  startDate: '2026-11-02',
  endDate: '2026-11-13',
  status: 'planned',
  completedAt: null,
  committedTasks: null,
  createdAt: new Date(),
  updatedAt: new Date(),
  ...overrides,
});

describe('SprintLifecyclePolicy', () => {
  it('accepts a two-week range and rejects reversed or overlong ones', () => {
    expect(() => SprintLifecyclePolicy.assertValidRange('2026-11-02', '2026-11-13')).not.toThrow();
    expect(() => SprintLifecyclePolicy.assertValidRange('2026-11-13', '2026-11-02')).toThrow(/on or after/);
    expect(() => SprintLifecyclePolicy.assertValidRange('2026-01-01', '2026-12-31')).toThrow(/at most/);
    expect(() => SprintLifecyclePolicy.assertValidRange('11/02/2026', '2026-11-13')).toThrow(/yyyy-mm-dd/);
  });

  it('starts only planned sprints when no other sprint is active', () => {
    expect(() => SprintLifecyclePolicy.assertCanStart(sprint(), false)).not.toThrow();
    expect(() => SprintLifecyclePolicy.assertCanStart(sprint(), true)).toThrow(/active sprint/);
    expect(() => SprintLifecyclePolicy.assertCanStart(sprint({ status: 'active' }), false)).toThrow(/planned/);
  });

  it('completes only the active sprint and freezes completed ones', () => {
    expect(() => SprintLifecyclePolicy.assertCanComplete(sprint({ status: 'active' }))).not.toThrow();
    expect(() => SprintLifecyclePolicy.assertCanComplete(sprint())).toThrow();
    expect(() => SprintLifecyclePolicy.assertEditable(sprint({ status: 'completed' }))).toThrow(/completed/);
    expect(() => SprintLifecyclePolicy.assertDeletable(sprint({ status: 'active' }))).toThrow(/planned/);
  });
});

describe('SprintRolloverPolicy', () => {
  const active = sprint({ status: 'active' });

  it('allows the backlog or a planned sprint in the same space', () => {
    expect(() => SprintRolloverPolicy.assertValidTarget(active, null)).not.toThrow();
    expect(() => SprintRolloverPolicy.assertValidTarget(active, sprint({ id: 's2' }))).not.toThrow();
  });

  it('rejects the same sprint, another space, or a non-planned sprint', () => {
    expect(() => SprintRolloverPolicy.assertValidTarget(active, active)).toThrow(/different/);
    expect(() => SprintRolloverPolicy.assertValidTarget(active, sprint({ id: 's2', spaceId: 'space-b' }))).toThrow(/same space/);
    expect(() => SprintRolloverPolicy.assertValidTarget(active, sprint({ id: 's2', status: 'completed' }))).toThrow(/planned/);
  });
});
