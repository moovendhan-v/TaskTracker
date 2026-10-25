import { STATUSES_PER_SPACE_MAX } from '@taskflow/shared-types';
import { DomainError } from '../../../core/domain/domain-error.js';
import type { TaskStatus } from './task-status.js';

/** Rules that keep every space's statuses usable. */
export const StatusPolicy = {
  assertRoomFor(existing: readonly TaskStatus[]): void {
    if (existing.length >= STATUSES_PER_SPACE_MAX) throw DomainError.invalid(`A space can have at most ${STATUSES_PER_SPACE_MAX} statuses`);
  },

  /** Deleting needs somewhere for its tasks to go: another status in the same space. */
  assertCanDelete(status: TaskStatus, siblings: readonly TaskStatus[], moveTo: TaskStatus | null): void {
    if (siblings.length <= 1) throw DomainError.invalid('A space needs at least one status');
    if (!moveTo || moveTo.id === status.id || moveTo.spaceId !== status.spaceId) {
      throw DomainError.invalid('Choose another status in the same space for its tasks');
    }
  },

  /** A reorder must name each of the space's statuses exactly once. */
  assertSameSet(current: readonly TaskStatus[], orderedIds: readonly string[]): void {
    const ids = new Set(orderedIds);
    if (ids.size !== orderedIds.length || ids.size !== current.length || current.some((status) => !ids.has(status.id))) {
      throw DomainError.invalid("List every one of the space's statuses once");
    }
  },
};
