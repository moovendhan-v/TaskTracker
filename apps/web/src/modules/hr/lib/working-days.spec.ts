import { describe, expect, it } from 'vitest';
import { previewWorkingDays } from './working-days';

describe('previewWorkingDays', () => {
  it('matches the server rules for common ranges', () => {
    expect(previewWorkingDays('2026-11-02', '2026-11-06')).toBe(5);
    expect(previewWorkingDays('2026-11-06', '2026-11-09')).toBe(2);
    expect(previewWorkingDays('2026-11-07', '2026-11-08')).toBe(0);
    expect(previewWorkingDays('2026-11-09', '2026-11-02')).toBe(0);
  });
});
