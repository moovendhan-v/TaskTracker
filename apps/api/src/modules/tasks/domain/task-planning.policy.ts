import type { Permission } from '@taskflow/shared-types';
import { DomainError } from '../../../core/domain/domain-error.js';

/** Moving a task in or out of a sprint is planning work: it needs sprint.manage, and the sprint must share the task's space. */
export const TaskPlanningPolicy = {
  assertCanPlan(held: ReadonlySet<Permission>): void {
    if (!held.has('sprint.manage')) throw DomainError.forbidden('Missing sprint.manage permission');
  },

  assertSameSpace(taskSpaceId: string, sprintSpaceId: string): void {
    if (taskSpaceId !== sprintSpaceId) throw DomainError.invalid('A task can only join a sprint in its own space');
  },
};
