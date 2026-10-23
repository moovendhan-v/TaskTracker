import { describe, expect, it } from 'vitest';
import type { Permission } from '@taskflow/shared-types';
import { TaskPlanningPolicy } from './task-planning.policy.js';

describe('TaskPlanningPolicy', () => {
  it('needs sprint.manage', () => {
    expect(() => TaskPlanningPolicy.assertCanPlan(new Set<Permission>(['task.update']))).toThrow(/sprint.manage/);
    expect(() => TaskPlanningPolicy.assertCanPlan(new Set<Permission>(['sprint.manage']))).not.toThrow();
  });

  it('keeps tasks in sprints of their own space', () => {
    expect(() => TaskPlanningPolicy.assertSameSpace('a', 'b')).toThrow(/own space/);
    expect(() => TaskPlanningPolicy.assertSameSpace('a', 'a')).not.toThrow();
  });
});
