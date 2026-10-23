import { SPRINT_MAX_DAYS } from '@taskflow/shared-types';
import { DomainError } from '../../../core/domain/domain-error.js';
import type { Sprint } from './sprint.js';

const DAY_MS = 86_400_000;
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

/** A sprint moves planned → active → completed, and a space runs one active sprint at a time. */
export const SprintLifecyclePolicy = {
  assertValidRange(startDate: string, endDate: string): void {
    if (!ISO_DATE.test(startDate) || !ISO_DATE.test(endDate)) throw DomainError.invalid('Dates must be yyyy-mm-dd');
    const days = (Date.parse(endDate) - Date.parse(startDate)) / DAY_MS;
    if (Number.isNaN(days) || days < 0) throw DomainError.invalid('The sprint must end on or after its start date');
    if (days > SPRINT_MAX_DAYS) throw DomainError.invalid(`A sprint can last at most ${SPRINT_MAX_DAYS} days`);
  },

  assertEditable(sprint: Sprint): void {
    if (sprint.status === 'completed') throw DomainError.invalid('A completed sprint can’t be changed');
  },

  assertCanStart(sprint: Sprint, spaceHasActiveSprint: boolean): void {
    if (sprint.status !== 'planned') throw DomainError.invalid('Only a planned sprint can be started');
    if (spaceHasActiveSprint) throw DomainError.conflict('Finish the active sprint in this space first');
  },

  assertCanComplete(sprint: Sprint): void {
    if (sprint.status !== 'active') throw DomainError.invalid('Only the active sprint can be completed');
  },

  assertDeletable(sprint: Sprint): void {
    if (sprint.status !== 'planned') throw DomainError.invalid('Only planned sprints can be deleted');
  },

  assertCanReceiveTasks(sprint: Sprint): void {
    if (sprint.status === 'completed') throw DomainError.invalid('Tasks can’t be added to a completed sprint');
  },
};
