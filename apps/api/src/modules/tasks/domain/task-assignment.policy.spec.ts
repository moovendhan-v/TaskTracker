import { describe, expect, it } from 'vitest';
import type { Permission } from '@taskflow/shared-types';
import { TaskAssignmentPolicy } from './task-assignment.policy.js';

describe('TaskAssignmentPolicy', () => {
  it('requires task.assign', () => {
    expect(() => TaskAssignmentPolicy.assertCanChangeAssignee(new Set<Permission>(['task.update']))).toThrow(
      /task.assign/,
    );
    expect(() => TaskAssignmentPolicy.assertCanChangeAssignee(new Set<Permission>(['task.assign']))).not.toThrow();
  });

  it('rejects assignees outside the workspace', () => {
    expect(() => TaskAssignmentPolicy.assertAssigneeIsMember(false)).toThrow(/member/);
  });
});
