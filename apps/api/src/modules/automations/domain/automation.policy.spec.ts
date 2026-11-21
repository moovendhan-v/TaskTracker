import { describe, expect, it } from 'vitest';
import { AutomationPolicy, type TaskFacts } from './automation.policy.js';

const S1 = '11111111-1111-4111-8111-111111111111';
const L1 = '22222222-2222-4222-8222-222222222222';
const task: TaskFacts = { listId: L1, statusId: S1, statusCategory: 'done', priority: 'high', type: 'bug' };

describe('AutomationPolicy', () => {
  it('matches the trigger and every condition that is set', () => {
    const rule = { trigger: { type: 'task_status_changed' as const, categories: ['done' as const] }, conditions: { listIds: [L1], types: ['bug' as const] } };
    expect(AutomationPolicy.matches(rule, 'task_status_changed', task)).toBe(true);
    expect(AutomationPolicy.matches(rule, 'task_created', task)).toBe(false);
    expect(AutomationPolicy.matches(rule, 'task_status_changed', { ...task, statusCategory: 'started' })).toBe(false);
    expect(AutomationPolicy.matches(rule, 'task_status_changed', { ...task, type: 'task' })).toBe(false);
  });

  it('reads which triggers a change fires', () => {
    expect(AutomationPolicy.triggersForTaskEvent({ type: 'task.updated', facts: { changes: [{ field: 'status' }, { field: 'due date' }] } })).toEqual(['task_status_changed', 'task_due_date_changed']);
    expect(AutomationPolicy.triggersForTaskEvent({ type: 'task.updated', facts: { changes: [{ field: 'assignee' }], assigneeId: null, previousAssigneeId: 'a' } })).toEqual([]);
    expect(AutomationPolicy.triggersForTaskEvent({ type: 'task.updated', facts: { changes: [{ field: 'assignee' }], assigneeId: 'b', previousAssigneeId: 'a' } })).toEqual(['task_assigned']);
    expect(AutomationPolicy.triggersForTaskEvent({ type: 'comment.created' })).toEqual(['task_commented']);
  });

  it('normalizes actions and rejects incomplete ones', () => {
    expect(AutomationPolicy.normalizeActions([{ type: 'set_priority', priority: 'urgent', statusId: S1 }])).toEqual([{ type: 'set_priority', priority: 'urgent' }]);
    expect(() => AutomationPolicy.normalizeActions([])).toThrow(/at least one/);
    expect(() => AutomationPolicy.normalizeActions([{ type: 'notify', audiences: ['assignee'], message: ' ' }])).toThrow(/message/);
    expect(() => AutomationPolicy.normalizeActions([{ type: 'notify', message: 'hi' }])).toThrow(/who to notify/);
    expect(() => AutomationPolicy.normalizeActions([{ type: 'set_status', statusId: 'nope' }])).toThrow(/status/);
    // move_to_list keeps only the list, needs task.update, and its list is checked against the space.
    expect(AutomationPolicy.normalizeActions([{ type: 'move_to_list', listId: S1, statusId: S1 }])).toEqual([{ type: 'move_to_list', listId: S1 }]);
    expect(() => AutomationPolicy.normalizeActions([{ type: 'move_to_list', listId: 'nope' }])).toThrow(/pick a list/);
    expect(AutomationPolicy.requiredPermissions([{ type: 'move_to_list', listId: S1 }])).toEqual(['task.update']);
    expect(AutomationPolicy.referencedIds({ type: 'task_created' }, {}, [{ type: 'move_to_list', listId: S1 }]).listIds).toEqual([S1]);
  });

  it('checks create-task actions and run-once schedules', () => {
    expect(AutomationPolicy.normalizeActions([{ type: 'create_task', listId: L1, title: ' Stand-up {{date}} ', statusId: S1 }])).toEqual([{ type: 'create_task', listId: L1, title: 'Stand-up {{date}}', userId: null, days: null }]);
    expect(() => AutomationPolicy.normalizeActions([{ type: 'create_task', listId: L1, title: 'x'.repeat(201) }])).toThrow(/too long/);
    expect(() => AutomationPolicy.normalizeActions([{ type: 'create_task', listId: L1, title: 'Ok', days: -1 }])).toThrow(/due in/);
    // Assigning the new task needs task.assign too; its list is checked against the space.
    expect(AutomationPolicy.requiredPermissions([{ type: 'create_task', listId: L1, title: 'Ok' }])).toEqual(['task.create']);
    expect(AutomationPolicy.requiredPermissions([{ type: 'create_task', listId: L1, title: 'Ok', userId: 'u' }])).toEqual(['task.create', 'task.assign']);
    expect(AutomationPolicy.referencedIds({ type: 'task_created' }, {}, [{ type: 'create_task', listId: L1, title: 'Ok', userId: 'u' }])).toMatchObject({ listIds: [L1], userIds: ['u'] });

    const once = AutomationPolicy.normalizeTrigger({ type: 'on_schedule', schedule: { frequency: 'daily', time: '09:00', timeZone: 'UTC', runFor: 'once' } });
    expect(once.schedule?.runFor).toBe('once');
    expect(AutomationPolicy.normalizeTrigger({ type: 'on_schedule', schedule: { frequency: 'daily', time: '09:00', timeZone: 'UTC', runFor: 'each_task' } }).schedule?.runFor).toBeUndefined();
    expect(() => AutomationPolicy.normalizeTrigger({ type: 'on_schedule', schedule: { frequency: 'daily', time: '09:00', timeZone: 'UTC', runFor: 'twice' as 'once' } })).toThrow(/runs for/);
    const create = { type: 'create_task' as const, listId: L1, title: 'Ok' };
    expect(() => AutomationPolicy.assertRunsOnceShape(once, {}, null, [create, { type: 'unassign' }])).not.toThrow();
    expect(() => AutomationPolicy.assertRunsOnceShape(once, {}, null, [{ type: 'unassign' }, create])).toThrow(/start by creating/);
    expect(() => AutomationPolicy.assertRunsOnceShape(once, { types: ['bug'] }, null, [create])).toThrow(/remove the conditions/);
    expect(() => AutomationPolicy.assertRunsOnceShape(once, {}, { steps: [{ id: 'i', kind: 'if', condition: { field: 'type', types: ['bug'] }, yes: [{ id: 'a', kind: 'action', action: create }], no: [] }] }, [create])).toThrow(/start by creating/);
    // Each-task schedules and other triggers don't need it.
    expect(() => AutomationPolicy.assertRunsOnceShape({ type: 'task_created' }, {}, null, [{ type: 'unassign' }])).not.toThrow();
  });

  it('lists what the actions need from the person the rule runs as', () => {
    expect(AutomationPolicy.requiredPermissions([{ type: 'assign', userId: 'u' }, { type: 'notify' }])).toEqual(['task.update', 'task.assign']);
  });
});
