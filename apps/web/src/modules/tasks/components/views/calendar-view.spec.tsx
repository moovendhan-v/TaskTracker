import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import type { TaskResponse } from '@taskflow/shared-types';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CalendarView } from './calendar-view';

vi.mock('@/core/preferences/use-preferences', () => ({ usePreferences: () => ({ weekStart: 1 }) }));
vi.mock('@/modules/workspaces', () => ({ usePermissions: () => ({ canIn: () => true }) }));
vi.mock('@/modules/members', () => ({ useMemberName: () => (id: string | null) => (id === 'u1' ? 'Dana Reyes' : null) }));
vi.mock('../../hooks/use-task-mutations', () => ({ useTaskMutations: () => ({ update: { mutate: vi.fn() } }) }));

const status = (category: 'unstarted' | 'done') => ({ id: category, name: category, color: '#888', category }) as unknown as TaskResponse['status'];
let number = 0;
const task = (title: string, dueDate: string | null, extra: Partial<TaskResponse> = {}): TaskResponse =>
  ({ id: title, number: ++number, title, dueDate, startDate: null, priority: 'none', spaceId: 's1', assigneeId: null, assigneeIds: [], status: status('unstarted'), ...extra }) as TaskResponse;

describe('CalendarView', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date(2026, 10, 21, 12));
  });
  afterEach(() => {
    cleanup();
    vi.useRealTimers();
  });

  it('marks overdue tasks, says how many have no date, and opens a busy day', () => {
    const tasks = [
      task('Late report', '2026-11-18T00:00:00.000Z', { assigneeId: 'u1', priority: 'urgent' }),
      task('Shipped', '2026-11-18T00:00:00.000Z', { status: status('done') }),
      ...['One', 'Two', 'Three', 'Four', 'Five'].map((title) => task(title, '2026-11-24T00:00:00.000Z')),
      task('Someday', null),
    ];
    render(<CalendarView workspaceId="w1" tasks={tasks} onOpen={() => {}} />);

    expect(screen.getByRole('heading', { name: 'November 2026' })).toBeTruthy();
    expect(screen.getByText('1 task has no date')).toBeTruthy();
    // Overdue only when still open; the assignee and status are in the tooltip.
    expect(screen.getByRole('button', { name: /Late report/ }).getAttribute('title')).toBe('#1 Late report · Dana Reyes · Overdue');
    expect(screen.getByRole('button', { name: /Shipped/ }).getAttribute('title')).toBe('#2 Shipped');
    expect(screen.getByLabelText('Urgent priority')).toBeTruthy();

    // Three a day, then "+2 more" opens the rest in place.
    expect(screen.queryByRole('button', { name: 'Four' })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: '+2 more' }));
    expect(screen.getByRole('button', { name: 'Five' })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Show less' }));
    expect(screen.queryByRole('button', { name: 'Five' })).toBeNull();
  });
});
