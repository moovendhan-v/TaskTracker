import type { Permission } from '@taskflow/shared-types';
import { DomainError } from '../../../core/domain/domain-error.js';

/** Changing a task's assignee needs task.assign, and the new assignee must belong to the workspace. */
export const TaskAssignmentPolicy = {
  assertCanChangeAssignee(held: ReadonlySet<Permission>): void {
    if (!held.has('task.assign')) throw DomainError.forbidden('Missing task.assign permission');
  },

  assertAssigneeIsMember(isMember: boolean): void {
    if (!isMember) throw DomainError.invalid('Assignee must be a member of this workspace');
  },
};
