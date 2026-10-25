import { describe, expect, it } from 'vitest';
import type { TaskResponse, TaskStatusResponse } from '@taskflow/shared-types';
import { groupTasks } from './group-tasks';

const status = (id: string, name: string, position: number): TaskStatusResponse => ({ id, spaceId: 's', name, color: '#000000', category: 'unstarted', position });
const todo = status('todo', 'To do', 1);
const doing = status('doing', 'Doing', 2);
const task = (id: string, extra: Partial<TaskResponse>) => ({ id, statusId: 'todo', status: todo, position: 1, priority: 'none', assigneeId: null, ...extra }) as TaskResponse;
const names = (id: string | null) => ({ u1: 'Zed', u2: 'Ann' })[id ?? ''] ?? null;

describe('groupTasks', () => {
  const tasks = [task('a', { position: 2 }), task('b', { statusId: 'doing', status: doing, assigneeId: 'u1', priority: 'high' }), task('c', { position: 1, assigneeId: 'u2', priority: 'high' })];

  it('keeps every status, in workflow order, with tasks by position', () => {
    expect(groupTasks(tasks, 'status', [todo, doing], names).map((group) => [group.label, group.tasks.map((t) => t.id)])).toEqual([
      ['To do', ['c', 'a']],
      ['Doing', ['b']],
    ]);
  });

  it('groups by assignee alphabetically with Unassigned last', () => {
    expect(groupTasks(tasks, 'assignee', [todo, doing], names).map((group) => group.label)).toEqual(['Ann', 'Zed', 'Unassigned']);
  });

  it('shows only priorities that have tasks, most urgent first', () => {
    expect(groupTasks(tasks, 'priority', [], names).map((group) => group.key)).toEqual(['high', 'none']);
  });
});
