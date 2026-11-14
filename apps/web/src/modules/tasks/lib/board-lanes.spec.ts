import { describe, expect, it } from 'vitest';
import type { TaskResponse } from '@taskflow/shared-types';
import { boardLanes, wipState } from './board-lanes';

const task = (id: string, extra: Partial<TaskResponse>): TaskResponse => ({ id, position: Number(id.replace(/\D/g, '')) || 0, type: 'task', priority: 'none', assigneeId: null, ...extra }) as TaskResponse;
const names = (id: string | null) => ({ u1: 'Avery', u2: 'Blake' })[id ?? ''] ?? null;

describe('board swimlanes', () => {
  const tasks = [task('t1', { assigneeId: 'u2', priority: 'high', type: 'bug' }), task('t2', { assigneeId: 'u1', type: 'feature' }), task('t3', {}), task('t4', { assigneeId: 'u1', priority: 'urgent' })];

  it('makes one lane per assignee (unassigned last), and dropping sets the assignee', () => {
    const lanes = boardLanes(tasks, 'assignee', names);
    expect(lanes.map((lane) => [lane.label, lane.tasks.map((item) => item.id)])).toEqual([
      ['Avery', ['t2', 't4']],
      ['Blake', ['t1']],
      ['Unassigned', ['t3']],
    ]);
    expect(lanes[2]!.sets).toEqual({ assigneeId: null });
  });

  it('orders priority lanes from urgent down, and type lanes as the types go, skipping empty ones', () => {
    expect(boardLanes(tasks, 'priority', names).map((lane) => lane.key)).toEqual(['urgent', 'high', 'none']);
    expect(boardLanes(tasks, 'priority', names)[0]!.sets).toEqual({ priority: 'urgent' });
    expect(boardLanes(tasks, 'type', names).map((lane) => lane.key)).toEqual(['task', 'bug', 'feature']);
    expect(boardLanes(tasks, 'none', names)).toHaveLength(1);
  });

  it('says where a column stands against its limit', () => {
    expect(wipState(3, null)).toBe('none');
    expect(wipState(2, 3)).toBe('under');
    expect(wipState(3, 3)).toBe('at');
    expect(wipState(4, 3)).toBe('over');
  });
});
