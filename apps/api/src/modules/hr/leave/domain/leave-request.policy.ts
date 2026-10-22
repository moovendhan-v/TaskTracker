import { LEAVE_MAX_DAYS } from '@taskflow/shared-types';
import { DomainError } from '../../../../core/domain/domain-error.js';
import { countWorkingDays } from './leave-days.calculator.js';
import { leaveYear } from './leave-request.js';

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

/** Rules for asking for time off. Returns the number of working days requested. */
export const LeaveRequestPolicy = {
  validateRange(startDate: string, endDate: string): number {
    if (!ISO_DATE.test(startDate) || !ISO_DATE.test(endDate)) throw DomainError.invalid('Dates must be yyyy-mm-dd');
    if (endDate < startDate) throw DomainError.invalid('Time off must end on or after its first day');
    if (leaveYear(startDate) !== leaveYear(endDate)) {
      throw DomainError.invalid('Split time off that crosses into a new year into two requests');
    }
    const days = countWorkingDays(startDate, endDate);
    if (days === 0) throw DomainError.invalid('The range has no working days');
    if (days > LEAVE_MAX_DAYS) throw DomainError.invalid(`One request can cover at most ${LEAVE_MAX_DAYS} working days`);
    return days;
  },

  assertNoOverlap(overlaps: boolean): void {
    if (overlaps) throw DomainError.conflict('You already have time off booked or pending on those days');
  },
};
