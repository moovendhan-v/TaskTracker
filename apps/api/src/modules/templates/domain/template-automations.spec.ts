import { fromTemplateAutomation, placeholderId, placeholderIndex, templateAutomationLeaks, toTemplateAutomation, type AutomationFlow } from '@taskflow/shared-types';
import { describe, expect, it } from 'vitest';

const DONE = '2f6c2a8e-3a52-4c1e-9d1a-2b3c4d5e6f72';
const BUGS = '3f6c2a8e-3a52-4c1e-9d1a-2b3c4d5e6f73';
const DANA = 'user_dana';

const flow: AutomationFlow = {
  steps: [
    {
      id: 'in-bugs',
      kind: 'if',
      condition: { field: 'list', listIds: [BUGS] },
      yes: [
        { id: 'close', kind: 'action', action: { type: 'set_status', statusId: DONE } },
        { id: 'assign', kind: 'action', action: { type: 'assign', userId: DANA } },
        { id: 'tell', kind: 'action', action: { type: 'notify', audiences: ['creator'], userIds: [DANA], message: 'Closed {{task}}' } },
        { id: 'hook', kind: 'action', action: { type: 'webhook', url: 'https://hooks.example.com/x' } },
      ],
      no: [],
    },
  ],
};
const index = { status: (id: string) => (id === DONE ? 3 : undefined), list: (id: string) => (id === BUGS ? 1 : undefined) };

describe('automations in templates', () => {
  it('swaps ids for placeholders and leaves out people, channels and webhooks', () => {
    const portable = toTemplateAutomation({ name: 'Close bugs', enabled: true, trigger: { type: 'task_status_changed', statusIds: [DONE] }, flow }, index)!;
    expect(portable.trigger.statusIds).toEqual([placeholderId('status', 3)]);
    const steps = (portable.flow.steps[0] as { yes: { id: string }[]; condition: { listIds: string[] } });
    expect(steps.condition.listIds).toEqual([placeholderId('list', 1)]);
    expect(steps.yes.map((step) => step.id)).toEqual(['close', 'tell']);
    expect(JSON.stringify(portable)).not.toContain(DANA);
    expect(templateAutomationLeaks(portable)).toBe(false);
    expect(placeholderIndex('status', placeholderId('status', 3))).toBe(3);
    expect(placeholderIndex('list', placeholderId('status', 3))).toBeNull();

    // Applied to a new project, the placeholders become its own ids.
    const bound = fromTemplateAutomation(portable, { statuses: ['s0', 's1', 's2', 'new-done'], lists: ['l0', 'new-bugs'] })!;
    expect(bound.trigger.statusIds).toEqual(['new-done']);
    expect(JSON.stringify(bound.flow)).toContain('new-bugs');
    expect(fromTemplateAutomation(portable, { statuses: ['s0'], lists: [] })).toBeNull();
  });

  it('skips rules that only make sense with named people, or that keep no actions', () => {
    const people: AutomationFlow = { steps: [{ id: 'mine', kind: 'if', condition: { field: 'assignee', match: 'people', userIds: [DANA] }, yes: [{ id: 'p', kind: 'action', action: { type: 'set_priority', priority: 'high' } }], no: [] }] };
    expect(toTemplateAutomation({ name: 'x', enabled: true, trigger: { type: 'task_created' }, flow: people }, index)).toBeNull();
    const onlyPeople: AutomationFlow = { steps: [{ id: 'a', kind: 'action', action: { type: 'assign', userId: DANA } }] };
    expect(toTemplateAutomation({ name: 'x', enabled: true, trigger: { type: 'task_created' }, flow: onlyPeople }, index)).toBeNull();
    expect(toTemplateAutomation({ name: 'x', enabled: true, trigger: { type: 'task_status_changed', statusIds: ['9f6c2a8e-3a52-4c1e-9d1a-2b3c4d5e6f79'] }, flow: { steps: [{ id: 'p', kind: 'action', action: { type: 'set_priority', priority: 'high' } }] } }, index)).toBeNull();
  });
});
