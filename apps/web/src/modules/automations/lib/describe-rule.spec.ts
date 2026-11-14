import { describe, expect, it } from 'vitest';
import { describeFlow, describeRule, describeSchedule } from './describe-rule';

const names = { status: () => 'Done', list: () => 'Bugs', person: () => 'Dana' };

describe('describing scheduled automations', () => {
  it('names the due-soon window', () => {
    expect(describeRule({ trigger: { type: 'task_due_soon', days: 3 }, conditions: {}, actions: [{ type: 'unassign' }] }, names)).toBe('When a task is due soon (within 3 days), then unassign it.');
    expect(describeRule({ trigger: { type: 'task_due_soon', days: 0 }, conditions: {}, actions: [{ type: 'unassign' }] }, names)).toBe('When a task is due soon (due today), then unassign it.');
  });

  it('reads a wait in the flow sentence', () => {
    const flow = { steps: [{ id: 'w', kind: 'wait' as const, minutes: 2880 }, { id: 'a', kind: 'action' as const, action: { type: 'comment' as const, message: 'Ping' } }] };
    expect(describeFlow({ type: 'task_overdue' }, flow, names)).toBe('When a task becomes overdue, then wait 2 days, then comment “Ping”.');
  });

  it('describes moving a task to a list', () => {
    expect(describeRule({ trigger: { type: 'task_status_changed', categories: ['done'] }, conditions: {}, actions: [{ type: 'move_to_list', listId: 'l1' }] }, names)).toMatch(/then move it to Bugs\.$/);
    expect(describeRule({ trigger: { type: 'task_created' }, conditions: {}, actions: [{ type: 'move_to_list' }] }, names)).toMatch(/then move it to …\.$/);
  });

  it('describes repeating schedules and sprint triggers', () => {
    const comment = [{ type: 'comment' as const, message: 'Nudge' }];
    expect(describeSchedule({ frequency: 'weekdays', time: '09:00', timeZone: 'Europe/Berlin' })).toBe('09:00 on weekdays (Europe/Berlin)');
    expect(describeSchedule({ frequency: 'weekly', time: '17:30', timeZone: 'UTC', weekdays: [1, 3, 5] })).toBe('17:30 every Monday, Wednesday and Friday (UTC)');
    expect(describeSchedule({ frequency: 'monthly', time: '08:00', timeZone: 'UTC', monthDay: 1 })).toBe('08:00 on day 1 of each month (UTC)');
    expect(describeRule({ trigger: { type: 'on_schedule', schedule: { frequency: 'daily', time: '09:00', timeZone: 'UTC' } }, conditions: { listIds: ['l1'] }, actions: comment }, names)).toBe(
      'When it’s 09:00 every day (UTC), for each open task in Bugs, then comment “Nudge”.'.replace('’', "'"),
    );
    expect(describeRule({ trigger: { type: 'sprint_completed' }, conditions: {}, actions: comment }, names)).toBe('When a sprint is completed, for each task in it, then comment “Nudge”.');
  });
});
