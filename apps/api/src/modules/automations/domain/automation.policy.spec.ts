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
  });

  it('lists what the actions need from the person the rule runs as', () => {
    expect(AutomationPolicy.requiredPermissions([{ type: 'assign', userId: 'u' }, { type: 'notify' }])).toEqual(['task.update', 'task.assign']);
  });
});
