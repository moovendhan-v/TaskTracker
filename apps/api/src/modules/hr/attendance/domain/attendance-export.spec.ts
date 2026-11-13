import { describe, expect, it } from 'vitest';
import { clipBreaks } from '@taskflow/shared-types';
import { csvCell, formatAttendanceCsv, isTimeZone } from './attendance-export.js';

describe('attendance export', () => {
  const now = new Date('2026-11-13T12:00:00Z');
  const names = new Map([['u1', 'Avery'], ['u2', '=HYPERLINK("x")']]);

  it('writes one row per shift in the time zone, with breaks and worked time', () => {
    const csv = formatAttendanceCsv(
      [
        { userId: 'u1', startedAt: new Date('2026-11-10T08:00:00Z'), endedAt: new Date('2026-11-10T16:30:00Z'), breaks: [{ start: '2026-11-10T12:00:00Z', end: '2026-11-10T12:30:00Z' }], correctionReason: null },
        { userId: 'u2', startedAt: new Date('2026-11-10T22:00:00Z'), endedAt: new Date('2026-11-11T06:00:00Z'), breaks: [], correctionReason: 'Forgot to clock out' },
        { userId: 'gone', startedAt: new Date('2026-11-13T09:00:00Z'), endedAt: null, breaks: [], correctionReason: null },
      ],
      names,
      'Europe/Berlin',
      now,
    );
    const lines = csv.slice(1).trimEnd().split('\r\n');
    expect(csv.charCodeAt(0)).toBe(0xfeff);
    expect(lines[0]).toBe('"Person","Date","Clock in","Clock out","Breaks (min)","Worked","Worked (min)","Corrected"');
    expect(lines[1]).toBe('"Avery","2026-11-10","09:00","17:30","30","8:00","480",""');
    // Ends the next day (Berlin), and a formula-looking name is defused.
    expect(lines[2]).toBe(`"'=HYPERLINK(""x"")","2026-11-10","23:00","2026-11-11 07:00","0","8:00","480","Forgot to clock out"`);
    expect(lines[3]).toBe('"Former member","2026-11-13","10:00","","0","3:00","180",""');
  });

  it('defuses formulas and quotes', () => {
    expect(csvCell('+1')).toBe(`"'+1"`);
    expect(csvCell('-2')).toBe(`"'-2"`);
    expect(csvCell('@x')).toBe(`"'@x"`);
    expect(csvCell('say "hi"')).toBe('"say ""hi"""');
  });

  it('accepts only real time zone names', () => {
    expect(isTimeZone('Europe/Berlin')).toBe(true);
    expect(isTimeZone('UTC')).toBe(true);
    expect(isTimeZone('Mars/Base')).toBe(false);
    expect(isTimeZone('../etc')).toBe(false);
  });

  it('keeps breaks inside corrected times', () => {
    const breaks = [
      { start: '2026-11-10T07:00:00Z', end: '2026-11-10T07:30:00Z' },
      { start: '2026-11-10T07:45:00Z', end: '2026-11-10T08:15:00Z' },
      { start: '2026-11-10T12:00:00Z', end: null },
    ];
    expect(clipBreaks(breaks, '2026-11-10T08:00:00.000Z', '2026-11-10T12:20:00.000Z')).toEqual([
      { start: '2026-11-10T08:00:00.000Z', end: '2026-11-10T08:15:00.000Z' },
      { start: '2026-11-10T12:00:00.000Z', end: '2026-11-10T12:20:00.000Z' },
    ]);
  });
});
