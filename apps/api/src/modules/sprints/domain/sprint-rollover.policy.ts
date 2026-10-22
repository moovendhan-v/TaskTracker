import { DomainError } from '../../../core/domain/domain-error.js';
import type { Sprint } from './sprint.js';

/** Unfinished tasks go to the backlog or to another planned sprint in the same space. */
export const SprintRolloverPolicy = {
  assertValidTarget(completing: Sprint, target: Sprint | null): void {
    if (!target) return;
    if (target.id === completing.id) throw DomainError.invalid('Choose a different sprint for unfinished tasks');
    if (target.spaceId !== completing.spaceId) throw DomainError.invalid('Unfinished tasks must stay in the same space');
    if (target.status !== 'planned') throw DomainError.invalid('Unfinished tasks can only move to a planned sprint');
  },
};
