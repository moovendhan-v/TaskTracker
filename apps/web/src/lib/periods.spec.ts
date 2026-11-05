import { describe, expect, it } from 'vitest';
import { localDay, periodLabel, periodPhrase, periodWindow } from './periods';

describe('custom periods', () => {
  it('covers whole local days, both ends included', () => {
    const window = periodWindow('custom:2026-03-10..2026-03-16', 1);
    expect(localDay(window.from)).toBe('2026-03-10');
    expect(localDay(window.to)).toBe('2026-03-17');
    expect(window.from.getHours()).toBe(0);
  });

  it('reads as dates, and keeps its capitals in a sentence', () => {
    expect(periodLabel('custom:2026-03-10..2026-03-16')).toMatch(/Mar 10.*Mar 16/);
    expect(periodLabel('custom:2025-12-20..2026-01-05')).toMatch(/2025.*2026/);
    expect(periodPhrase('last_month')).toBe('last month');
    expect(periodPhrase('custom:2026-03-10..2026-03-16')).toMatch(/^Mar/);
  });
});
