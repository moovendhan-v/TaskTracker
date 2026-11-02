import { describe, expect, it } from 'vitest';
import { dayGroup, timeAgo } from './relative-time';

const now = new Date(2026, 10, 1, 12, 0, 0);
const ago = (minutes: number) => new Date(now.getTime() - minutes * 60_000).toISOString();

describe('relative time', () => {
  it('says how long ago, briefly', () => {
    expect(timeAgo(ago(0), now)).toBe('now');
    expect(timeAgo(ago(8), now)).toBe('8 min ago');
    expect(timeAgo(ago(1), now)).toBe('1 min ago');
    expect(timeAgo(ago(3 * 60), now)).toBe('3 hours ago');
    expect(timeAgo(ago(25 * 60), now)).toBe('yesterday');
    expect(timeAgo(ago(3 * 24 * 60), now)).toBe('3 days ago');
  });

  it('groups by calendar day, not 24-hour windows', () => {
    expect(dayGroup(ago(60), now)).toBe('Today');
    expect(dayGroup(new Date(2026, 9, 31, 23, 59).toISOString(), now)).toBe('Yesterday');
    expect(dayGroup(new Date(2026, 9, 30, 12).toISOString(), now)).toBe('Earlier');
  });
});
