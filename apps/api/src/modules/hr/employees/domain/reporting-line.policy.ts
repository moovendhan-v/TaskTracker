import { DomainError } from '../../../../core/domain/domain-error.js';

/** Nobody manages themselves, and reporting lines never loop back. */
export const ReportingLinePolicy = {
  /**
   * @param userId the person whose manager is changing
   * @param managerChain the new manager followed by everyone above them
   */
  assertValidManager(userId: string, managerChain: readonly string[]): void {
    if (managerChain[0] === userId) throw DomainError.invalid('People can’t manage themselves');
    if (managerChain.includes(userId)) throw DomainError.invalid('That would make a circular reporting line');
  },
};
