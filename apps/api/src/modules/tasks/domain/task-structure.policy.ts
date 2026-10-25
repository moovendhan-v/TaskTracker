import { SUBTASK_DEPTH_MAX } from '@taskflow/shared-types';
import { DomainError } from '../../../core/domain/domain-error.js';
import type { Task } from './task.js';

/** Rules for subtasks and dates. */
export const TaskStructurePolicy = {
  /** A subtask lives in its parent's list, at most SUBTASK_DEPTH_MAX levels below a top-level task. */
  assertValidParent(listId: string, parent: Pick<Task, 'listId'>, parentDepth: number): void {
    if (parent.listId !== listId) throw DomainError.invalid('A subtask must be in the same list as its parent');
    if (parentDepth + 1 > SUBTASK_DEPTH_MAX) throw DomainError.invalid(`Subtasks can nest at most ${SUBTASK_DEPTH_MAX} levels`);
  },

  assertDates(startDate: Date | null, dueDate: Date | null): void {
    if (startDate && dueDate && startDate.getTime() > dueDate.getTime()) throw DomainError.invalid('The start date must be on or before the due date');
  },

  assertNotSelf(taskId: string, relatedTaskId: string): void {
    if (taskId === relatedTaskId) throw DomainError.invalid('A task cannot relate to itself');
  },
};
