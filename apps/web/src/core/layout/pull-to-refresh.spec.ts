import { describe, expect, it } from 'vitest';
import { PULL_TO_REFRESH_AT, pullDistance } from './pull-to-refresh';

describe('pullDistance', () => {
  it('ignores pushing up, resists pulling down, and stops at a limit', () => {
    expect(pullDistance(-30)).toBe(0);
    expect(pullDistance(100)).toBeCloseTo(55);
    expect(pullDistance(1000)).toBe(110);
  });

  it('reaches the refresh point with a pull a thumb can make', () => {
    expect(pullDistance(PULL_TO_REFRESH_AT * 2)).toBeGreaterThan(pullDistance(PULL_TO_REFRESH_AT));
    expect(pullDistance(PULL_TO_REFRESH_AT)).toBeLessThan(110);
  });
});
