import { describe, expect, it } from 'vitest';
import { snoozeOptions } from './snooze';

describe('snoozeOptions', () => {
  it('offers 3 hours, tomorrow at 9 and next Monday at 9, in local time', () => {
    // Wednesday 11 Nov 2026, 14:30 local.
    const [later, tomorrow, nextWeek] = snoozeOptions(new Date(2026, 10, 11, 14, 30));
    expect(later!.until).toEqual(new Date(2026, 10, 11, 17, 30));
    expect(tomorrow!.until).toEqual(new Date(2026, 10, 12, 9, 0));
    expect(nextWeek!.until).toEqual(new Date(2026, 10, 16, 9, 0));
  });

  it('means the following Monday on a Monday, and the next day on a Sunday', () => {
    expect(snoozeOptions(new Date(2026, 10, 16, 10, 0))[2]!.until).toEqual(new Date(2026, 10, 23, 9, 0));
    expect(snoozeOptions(new Date(2026, 10, 15, 10, 0))[2]!.until).toEqual(new Date(2026, 10, 16, 9, 0));
  });
});
