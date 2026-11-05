import type { DashboardRequest } from '@taskflow/shared-types';
import { localTimeZone, periodWindow, type Period } from '@/lib/periods';

/** The request for a period: stable strings, so the query key doesn't change on every render. */
export function dashboardInput(period: Period, weekStart: number, extra: Pick<DashboardRequest, 'spaceId' | 'userIds' | 'mine' | 'priorities' | 'categories'> = {}): DashboardRequest {
  const window = periodWindow(period, weekStart);
  return {
    from: window.from.toISOString(),
    to: window.to.toISOString(),
    timeZone: localTimeZone(),
    spaceId: extra.spaceId ?? null,
    userIds: extra.userIds ?? null,
    // Only sent when set, so plain requests keep their old cache key.
    ...(extra.mine ? { mine: true } : {}),
    ...(extra.priorities?.length ? { priorities: extra.priorities } : {}),
    ...(extra.categories?.length ? { categories: extra.categories } : {}),
  };
}
