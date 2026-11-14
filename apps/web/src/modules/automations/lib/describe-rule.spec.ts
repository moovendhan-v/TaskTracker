import { describe, expect, it } from 'vitest';
import { describeFlow, describeRule } from './describe-rule';

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
});
