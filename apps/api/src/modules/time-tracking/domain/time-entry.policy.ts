import { minutesBetween, TIME_LIMITS } from '@taskflow/shared-types';
import { DomainError } from '../../../core/domain/domain-error.js';

/** Rules every logged span of time follows, whoever logs it. */
export const TimeEntryPolicy = {
  /** Minutes for a finished span; rejects empty, reversed and over-long spans. */
  minutesFor(startedAt: Date, endedAt: Date): number {
    if (Number.isNaN(startedAt.getTime()) || Number.isNaN(endedAt.getTime())) throw DomainError.invalid('Give a valid start and end time');
    const minutes = minutesBetween(startedAt, endedAt);
    if (minutes < 1) throw DomainError.invalid('The end must be at least a minute after the start');
    if (minutes > TIME_LIMITS.entryMinutesMax) throw DomainError.invalid('One entry can cover at most 24 hours');
    return minutes;
  },

  /** Reports cover a bounded window, so one request can't scan years of entries. */
  checkRange(from: Date, to: Date): void {
    if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime()) || to <= from) throw DomainError.invalid('The range must end after it starts');
    if ((to.getTime() - from.getTime()) / 86_400_000 > TIME_LIMITS.rangeDaysMax) {
      throw DomainError.invalid(`A range can cover at most ${TIME_LIMITS.rangeDaysMax} days`);
    }
  },
};
