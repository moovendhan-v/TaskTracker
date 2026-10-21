import { DomainError } from '../../../core/domain/domain-error.js';

/** A workspace must always keep at least one owner. */
export const OwnerGuardPolicy = {
  assertAnotherOwnerRemains(currentOwnerCount: number): void {
    if (currentOwnerCount <= 1) throw DomainError.invalid('A workspace needs at least one owner');
  },
};
