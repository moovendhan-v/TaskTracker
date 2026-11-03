import { continuationAfter, describeWait, evaluateCondition, flowActions, flowFromRule, validateFlowShape, type AutomationFlow, type FlowStep, type FlowTaskFacts } from '@taskflow/shared-types';
import { describe, expect, it } from 'vitest';

const STATUS = '0f6c2a8e-3a52-4c1e-9d1a-2b3c4d5e6f70';
const LIST = '1f6c2a8e-3a52-4c1e-9d1a-2b3c4d5e6f71';
const task: FlowTaskFacts = {
  listId: LIST,
  statusId: STATUS,
  statusCategory: 'started',
  priority: 'urgent',
  type: 'bug',
  title: 'Fix Login crash',
  assigneeIds: ['u1'],
  dueDate: '2026-11-03',
};

describe('automation flows', () => {
  it('accepts a branching flow and refuses broken ones', () => {
    const flow: AutomationFlow = {
      steps: [
        {
          id: 'urgent',
          kind: 'if',
          condition: { field: 'priority', priorities: ['urgent'] },
          yes: [{ id: 'assign', kind: 'action', action: { type: 'assign', userId: 'u1' } }],
          no: [{ id: 'stop', kind: 'stop' }],
        },
      ],
    };
    expect(validateFlowShape(flow)).toEqual([]);
    expect(validateFlowShape({ steps: [] })).toEqual(['Add at least one step']);
    expect(validateFlowShape({ steps: [{ id: 'a', kind: 'stop' }, { id: 'a', kind: 'stop' }] })).toEqual(['Flow step 2: duplicate id']);
    expect(validateFlowShape({ steps: [{ id: 'Bad Id', kind: 'stop' }] })).toEqual(['Flow step 1: invalid id']);
    expect(validateFlowShape({ steps: [{ id: 'x', kind: 'loop' } as never] })).toEqual(['Flow step 1: unknown step']);
    expect(validateFlowShape({ steps: [{ id: 'x', kind: 'if', condition: { field: 'priority', priorities: ['huge'] } as never, yes: [], no: [] }] })).toEqual(['Flow step 1: priorities: pick from the list']);
    expect(validateFlowShape({ steps: [{ id: 'x', kind: 'if', condition: { field: 'list', listIds: ["x' OR 1=1"] }, yes: [], no: [] }] })[0]).toMatch(/lists must be a list of ids/);
  });

  it('limits depth and size', () => {
    const nest = (depth: number): AutomationFlow['steps'] => (depth === 0 ? [{ id: `leaf`, kind: 'stop' }] : [{ id: `if-${depth}`, kind: 'if', condition: { field: 'title', contains: 'x' }, yes: nest(depth - 1), no: [] }]);
    expect(validateFlowShape({ steps: nest(5) })).toEqual([]);
    expect(validateFlowShape({ steps: nest(6) })).toContain('Conditions can nest at most 5 deep');
    const many = Array.from({ length: 31 }, (_, i) => ({ id: `s-${i}`, kind: 'stop' as const }));
    expect(validateFlowShape({ steps: many })).toEqual(['A flow can have at most 30 steps']);
  });

  it('turns a flat rule into the same flow', () => {
    const flow = flowFromRule({ listIds: [LIST], priorities: ['urgent'], types: [] }, [{ type: 'unassign' }]);
    expect(flow.steps[0]).toMatchObject({ kind: 'if', condition: { field: 'list' }, yes: [{ kind: 'if', condition: { field: 'priority' }, yes: [{ kind: 'action' }] }] });
    expect(flowActions(flow)).toEqual([{ type: 'unassign' }]);
    expect(flowFromRule({}, [{ type: 'unassign' }]).steps).toEqual([{ id: 'action-1', kind: 'action', action: { type: 'unassign' } }]);
  });

  it('evaluates conditions against the task as it is', () => {
    const today = '2026-11-02';
    expect(evaluateCondition({ field: 'status', categories: ['started'] }, task, today)).toBe(true);
    expect(evaluateCondition({ field: 'assignee', match: 'unassigned' }, task, today)).toBe(false);
    expect(evaluateCondition({ field: 'assignee', match: 'people', userIds: ['u1'] }, task, today)).toBe(true);
    expect(evaluateCondition({ field: 'due', match: 'within', days: 1 }, task, today)).toBe(true);
    expect(evaluateCondition({ field: 'due', match: 'within', days: 0 }, task, today)).toBe(false);
    expect(evaluateCondition({ field: 'due', match: 'overdue' }, task, '2026-11-05')).toBe(true);
    expect(evaluateCondition({ field: 'due', match: 'overdue' }, { ...task, statusCategory: 'done' }, '2026-11-05')).toBe(false);
    expect(evaluateCondition({ field: 'due', match: 'none' }, { ...task, dueDate: null }, today)).toBe(true);
    expect(evaluateCondition({ field: 'title', contains: 'login' }, task, today)).toBe(true);
    expect(evaluateCondition({ field: 'type', types: ['task'] }, task, today)).toBe(false);
  });
});

describe('waits', () => {
  const act = (id: string): FlowStep => ({ id, kind: 'action', action: { type: 'unassign' } });
  const steps: FlowStep[] = [
    act('a'),
    { id: 'if', kind: 'if', condition: { field: 'priority', priorities: ['urgent'] }, yes: [act('b'), { id: 'w', kind: 'wait', minutes: 60 }, act('c')], no: [act('d')] },
    act('e'),
  ];

  it('resumes with the rest of the branch, then the steps after the if', () => {
    expect(continuationAfter(steps, 'w')?.map((step) => step.id)).toEqual(['c', 'e']);
    expect(continuationAfter(steps, 'a')?.map((step) => step.id)).toEqual(['if', 'e']);
    expect(continuationAfter(steps, 'e')).toEqual([]);
    expect(continuationAfter(steps, 'missing')).toBeNull();
  });

  it('checks wait lengths and how many there are', () => {
    expect(validateFlowShape({ steps })).toEqual([]);
    expect(validateFlowShape({ steps: [{ id: 'w', kind: 'wait', minutes: 1 }, act('a')] })[0]).toMatch(/5 minutes to 30 days/);
    expect(validateFlowShape({ steps: [{ id: 'w', kind: 'wait', minutes: 1.5 } as FlowStep, act('a')] })[0]).toMatch(/a wait lasts/);
    const many = Array.from({ length: 6 }, (_, index): FlowStep => ({ id: `w${index}`, kind: 'wait', minutes: 5 }));
    expect(validateFlowShape({ steps: [...many, act('a')] })).toContain('A flow can have at most 5 waits');
  });

  it('describes a wait in its largest whole unit', () => {
    expect(describeWait(90)).toBe('90 minutes');
    expect(describeWait(120)).toBe('2 hours');
    expect(describeWait(1440)).toBe('1 day');
  });
});
