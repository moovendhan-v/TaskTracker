import type { FlowStep } from '@taskflow/shared-types';
import { describe, expect, it } from 'vitest';
import { findStep, insertStep, newStepId, removeStep, replaceStep } from './flow-edit';

const flow: FlowStep[] = [
  { id: 'if-1', kind: 'if', condition: { field: 'title', contains: 'x' }, yes: [{ id: 'action-1', kind: 'action', action: { type: 'unassign' } }], no: [] },
];

describe('flow editing', () => {
  it('inserts at the top level and inside a branch', () => {
    const top = insertStep(flow, { parentId: null, branch: null, index: 1 }, { id: 'stop-1', kind: 'stop' });
    expect(top.map((step) => step.id)).toEqual(['if-1', 'stop-1']);
    const inNo = insertStep(flow, { parentId: 'if-1', branch: 'no', index: 0 }, { id: 'stop-1', kind: 'stop' });
    expect(findStep(inNo, 'stop-1')).toEqual({ id: 'stop-1', kind: 'stop' });
    expect((inNo[0] as Extract<FlowStep, { kind: 'if' }>).no).toHaveLength(1);
  });

  it('replaces a step, keeping an if-step’s branches', () => {
    const next = replaceStep(flow, { id: 'if-1', kind: 'if', condition: { field: 'priority', priorities: ['urgent'] }, yes: [], no: [] });
    expect(next[0]).toMatchObject({ condition: { field: 'priority' }, yes: [{ id: 'action-1' }] });
  });

  it('removes a step, and an if-step with its branches', () => {
    expect(findStep(removeStep(flow, 'action-1'), 'action-1')).toBeNull();
    expect(removeStep(flow, 'if-1')).toEqual([]);
  });

  it('makes unused ids', () => {
    expect(newStepId(flow, 'action')).toBe('action-2');
    expect(newStepId(flow, 'stop')).toBe('stop-1');
  });
});
