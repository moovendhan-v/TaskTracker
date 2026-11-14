import { describe, expect, it } from 'vitest';
import { dueScheduleDate, fillAutomationMessage, scheduleRunsOn, type AutomationSchedule } from '@taskflow/shared-types';
import { savedAfterRunTime } from './automation-scheduler.js';
import { AutomationPolicy } from '../domain/automation.policy.js';

const at = (iso: string) => new Date(iso);
const schedule = (overrides: Partial<AutomationSchedule> = {}): AutomationSchedule => ({ frequency: 'daily', time: '09:00', timeZone: 'Europe/Berlin', ...overrides });

describe('repeating schedules', () => {
  it('runs on the days its frequency names', () => {
    // 2026-11-16 is a Monday.
    expect(scheduleRunsOn(schedule(), 0, 15)).toBe(true);
    expect(scheduleRunsOn(schedule({ frequency: 'weekdays' }), 1, 16)).toBe(true);
    expect(scheduleRunsOn(schedule({ frequency: 'weekdays' }), 6, 21)).toBe(false);
    expect(scheduleRunsOn(schedule({ frequency: 'weekly', weekdays: [1, 4] }), 4, 19)).toBe(true);
    expect(scheduleRunsOn(schedule({ frequency: 'weekly', weekdays: [1, 4] }), 2, 17)).toBe(false);
    expect(scheduleRunsOn(schedule({ frequency: 'monthly', monthDay: 16 }), 1, 16)).toBe(true);
    expect(scheduleRunsOn(schedule({ frequency: 'monthly', monthDay: 16 }), 2, 17)).toBe(false);
  });

  it('is due once its time has passed in its own time zone', () => {
    // 07:59 UTC is 08:59 in Berlin (winter time): not yet. 08:00 UTC is 09:00: due.
    expect(dueScheduleDate(schedule(), at('2026-11-16T07:59:00Z'))).toBeNull();
    expect(dueScheduleDate(schedule(), at('2026-11-16T08:00:00Z'))).toBe('2026-11-16');
    // Late on the 16th in UTC it's already 08:30 on the 17th in Tokyo: the run date is Tokyo's.
    expect(dueScheduleDate(schedule({ timeZone: 'Asia/Tokyo', time: '08:00' }), at('2026-11-16T23:30:00Z'))).toBe('2026-11-17');
    expect(dueScheduleDate(schedule({ timeZone: 'Asia/Tokyo' }), at('2026-11-16T23:30:00Z'))).toBeNull();
    // Saturday in Berlin: a weekdays schedule doesn't run.
    expect(dueScheduleDate(schedule({ frequency: 'weekdays' }), at('2026-11-21T12:00:00Z'))).toBeNull();
  });

  it('waits for the next run day when the rule was saved after today’s time', () => {
    expect(savedAfterRunTime(at('2026-11-16T08:30:00Z'), '2026-11-16', '09:00', 'Europe/Berlin')).toBe(true);
    expect(savedAfterRunTime(at('2026-11-16T07:30:00Z'), '2026-11-16', '09:00', 'Europe/Berlin')).toBe(false);
    expect(savedAfterRunTime(at('2026-11-15T20:00:00Z'), '2026-11-16', '09:00', 'Europe/Berlin')).toBe(false);
  });

  it('checks schedules and keeps only what the frequency uses', () => {
    expect(AutomationPolicy.normalizeTrigger({ type: 'on_schedule', schedule: schedule({ frequency: 'monthly', monthDay: 1, weekdays: [2] }) })).toEqual({ type: 'on_schedule', schedule: { frequency: 'monthly', time: '09:00', timeZone: 'Europe/Berlin', monthDay: 1 } });
    expect(() => AutomationPolicy.normalizeSchedule(schedule({ time: '9:00' }))).toThrow(/HH:MM/);
    expect(() => AutomationPolicy.normalizeSchedule(schedule({ frequency: 'monthly', monthDay: 31 }))).toThrow(/1 to 28/);
    expect(() => AutomationPolicy.normalizeSchedule(schedule({ timeZone: 'Nowhere' }))).toThrow(/time zone/);
    // Sprint triggers take no settings.
    expect(AutomationPolicy.normalizeTrigger({ type: 'sprint_completed', days: 3 })).toEqual({ type: 'sprint_completed' });
  });

  it('fills in the sprint name', () => {
    expect(fillAutomationMessage('{{task}} is in {{sprint}}', { task: '#4 Search', status: 'To do', actor: 'Automation', sprint: 'Sprint 12' })).toBe('#4 Search is in Sprint 12');
  });
});
