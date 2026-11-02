import { flowSteps, type FlowStep } from '@taskflow/shared-types';

/** Where a step sits: the top level (parentId null), or an if-step's yes / no branch. */
export interface FlowSlot {
  parentId: string | null;
  branch: 'yes' | 'no' | null;
  index: number;
}

function mapBranch(steps: readonly FlowStep[], parentId: string | null, branch: 'yes' | 'no' | null, change: (list: FlowStep[]) => FlowStep[]): FlowStep[] {
  if (parentId === null) return change([...steps]);
  return steps.map((step) =>
    step.kind !== 'if'
      ? step
      : step.id === parentId
        ? { ...step, [branch ?? 'yes']: change([...step[branch ?? 'yes']]) }
        : { ...step, yes: mapBranch(step.yes, parentId, branch, change), no: mapBranch(step.no, parentId, branch, change) },
  );
}

export function insertStep(steps: readonly FlowStep[], slot: FlowSlot, step: FlowStep): FlowStep[] {
  return mapBranch(steps, slot.parentId, slot.branch, (list) => [...list.slice(0, slot.index), step, ...list.slice(slot.index)]);
}

export function replaceStep(steps: readonly FlowStep[], next: FlowStep): FlowStep[] {
  return steps.map((step) => {
    if (step.id === next.id) return next.kind === 'if' && step.kind === 'if' ? { ...next, yes: step.yes, no: step.no } : next;
    return step.kind === 'if' ? { ...step, yes: replaceStep(step.yes, next), no: replaceStep(step.no, next) } : step;
  });
}

/** Removes a step; an if-step goes with both of its branches. */
export function removeStep(steps: readonly FlowStep[], id: string): FlowStep[] {
  return steps.filter((step) => step.id !== id).map((step) => (step.kind === 'if' ? { ...step, yes: removeStep(step.yes, id), no: removeStep(step.no, id) } : step));
}

export function findStep(steps: readonly FlowStep[], id: string | null): FlowStep | null {
  return id ? (flowSteps(steps).find((step) => step.id === id) ?? null) : null;
}

/** A fresh step id like "action-3" that the flow doesn't use yet. */
export function newStepId(steps: readonly FlowStep[], kind: FlowStep['kind']): string {
  const used = new Set(flowSteps(steps).map((step) => step.id));
  let n = 1;
  while (used.has(`${kind}-${n}`)) n += 1;
  return `${kind}-${n}`;
}
