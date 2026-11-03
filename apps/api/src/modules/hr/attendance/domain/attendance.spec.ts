import { breakMinutes, workedMinutes } from '@taskflow/shared-types';
import { describe, expect, it } from 'vitest';

const at = (time: string) => `2026-11-03T${time}:00.000Z`;

describe('attendance minutes', () => {
  it('counts a shift minus its breaks', () => {
    const shift = { startedAt: at('09:00'), endedAt: at('17:30'), breaks: [{ start: at('12:00'), end: at('12:45') }, { start: at('15:00'), end: at('15:10') }] };
    expect(workedMinutes(shift, new Date(at('20:00')))).toBe(8 * 60 + 30 - 55);
  });

  it('counts an open shift and a running break up to now', () => {
    const now = new Date(at('11:30'));
    const shift = { startedAt: at('09:00'), endedAt: null, breaks: [{ start: at('11:00'), end: null }] };
    expect(breakMinutes(shift.breaks, now)).toBe(30);
    expect(workedMinutes(shift, now)).toBe(120);
  });

  it('never goes below zero', () => {
    expect(workedMinutes({ startedAt: at('09:00'), endedAt: at('09:05'), breaks: [{ start: at('09:00'), end: at('09:30') }] }, new Date(at('10:00')))).toBe(0);
  });
});
