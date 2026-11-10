import { isWalkable, meetingRoomChannelName, OFFICE_ZONES, officeStatus, zoneAt } from '@taskflow/shared-types';
import { describe, expect, it } from 'vitest';

const now = new Date('2026-11-09T12:00:00Z');
const seen = (minutesAgo: number) => new Date(now.getTime() - minutesAgo * 60_000);

describe('the office floor', () => {
  it('has walls on its edge and nowhere else', () => {
    expect(isWalkable(0, 5)).toBe(false);
    expect(isWalkable(23, 5)).toBe(false);
    expect(isWalkable(5, 13)).toBe(false);
    expect(isWalkable(1, 1)).toBe(true);
    expect(isWalkable(22, 12)).toBe(true);
    expect(isWalkable(2.5, 3)).toBe(false);
  });

  it('keeps every zone on the floor, without overlaps', () => {
    for (const zone of OFFICE_ZONES) {
      expect(isWalkable(zone.x, zone.y) && isWalkable(zone.x + zone.w - 1, zone.y + zone.h - 1)).toBe(true);
      for (let x = zone.x; x < zone.x + zone.w; x++) for (let y = zone.y; y < zone.y + zone.h; y++) expect(zoneAt(x, y)?.id).toBe(zone.id);
    }
    expect(meetingRoomChannelName(OFFICE_ZONES.find((zone) => zone.id === 'aurora')!)).toBe('room-aurora');
  });
});

describe('officeStatus', () => {
  const base = { chosen: 'available' as const, lastSeenAt: seen(0), inCall: false, x: 2, y: 2 };
  it('goes offline after a few quiet minutes, whatever else', () => {
    expect(officeStatus({ ...base, inCall: true, lastSeenAt: seen(4) }, now)).toBe('offline');
  });
  it('shows a huddle over the chosen state', () => {
    expect(officeStatus({ ...base, chosen: 'away', inCall: true }, now)).toBe('in_meeting');
  });
  it('shows away when chosen, and focused when chosen or in the focus area', () => {
    expect(officeStatus({ ...base, chosen: 'away' }, now)).toBe('away');
    expect(officeStatus({ ...base, chosen: 'focused' }, now)).toBe('focused');
    expect(officeStatus({ ...base, x: 2, y: 9 }, now)).toBe('focused');
    expect(officeStatus(base, now)).toBe('available');
  });
});
