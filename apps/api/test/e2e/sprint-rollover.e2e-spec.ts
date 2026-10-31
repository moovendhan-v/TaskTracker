import { describe, expect, it } from 'vitest';
import { addMember, createWorkspace } from './support/fixtures.js';
import { TestUser } from './support/api-client.js';

const CREATE_SPRINT = 'mutation($w: ID!, $s: ID!, $input: CreateSprintInput!) { createSprint(workspaceId: $w, spaceId: $s, input: $input) { id } }';
const CREATE_TASK = 'mutation($w: ID!, $l: ID!, $input: CreateTaskInput!) { createTask(workspaceId: $w, listId: $l, input: $input) { id } }';
const PLAN = 'mutation($w: ID!, $t: ID!, $sprint: ID) { updateTask(workspaceId: $w, taskId: $t, input: { sprintId: $sprint }) { sprintId } }';
const COMPLETE =
  'mutation($w: ID!, $s: ID!, $next: ID, $rollover: CompleteSprintMovesInput) { completeSprint(workspaceId: $w, sprintId: $s, moveOpenTasksToSprintId: $next, rollover: $rollover) { status } }';
const SPRINT_OF = 'query($w: ID!, $t: ID!) { task(workspaceId: $w, taskId: $t) { sprintId } }';

describe('completing a sprint with per-task destinations', () => {
  it('sends each unfinished task where asked, the rest to the default, in one go', async () => {
    const ws = await createWorkspace('Rollover owner');
    const w = ws.workspaceId;
    const sprint = async (name: string, startDate: string, endDate: string) =>
      (await ws.owner.data<{ createSprint: { id: string } }>(CREATE_SPRINT, { w, s: ws.spaceId, input: { name, startDate, endDate } })).createSprint.id;
    const current = await sprint('Current', '2026-11-02', '2026-11-13');
    const next = await sprint('Next', '2026-11-16', '2026-11-27');
    const later = await sprint('Later', '2026-11-30', '2026-12-11');
    const task = async (title: string) => (await ws.owner.data<{ createTask: { id: string } }>(CREATE_TASK, { w, l: ws.listId, input: { title } })).createTask.id;
    const [a, b, c, outside] = [await task('A'), await task('B'), await task('C'), await task('Not in the sprint')];
    for (const id of [a, b, c]) await ws.owner.data(PLAN, { w, t: id, sprint: current });
    await ws.owner.data('mutation($w: ID!, $s: ID!) { startSprint(workspaceId: $w, sprintId: $s) { id } }', { w, s: current });

    // Not allowed: the sprint itself as a destination, or the same task twice. Nothing moves.
    expect((await ws.owner.error(COMPLETE, { w, s: current, next, rollover: { moves: [{ taskId: b, sprintId: current }] } })).message).toMatch(/different sprint/);
    expect((await ws.owner.error(COMPLETE, { w, s: current, next, rollover: { moves: [{ taskId: b, sprintId: later }, { taskId: b, sprintId: null }] } })).message).toMatch(/one destination/);
    expect((await ws.owner.data<{ task: { sprintId: string } }>(SPRINT_OF, { w, t: b })).task.sprintId).toBe(current);

    // A task outside the sprint in the list is ignored, not moved.
    const done = await ws.owner.data<{ completeSprint: { status: string } }>(COMPLETE, {
      w,
      s: current,
      next,
      rollover: { moves: [{ taskId: b, sprintId: later }, { taskId: c, sprintId: null }, { taskId: outside, sprintId: later }] },
    });
    expect(done.completeSprint.status).toBe('completed');
    const sprintOf = async (id: string) => (await ws.owner.data<{ task: { sprintId: string | null } }>(SPRINT_OF, { w, t: id })).task.sprintId;
    expect(await sprintOf(a)).toBe(next);
    expect(await sprintOf(b)).toBe(later);
    expect(await sprintOf(c)).toBeNull();
    expect(await sprintOf(outside)).toBeNull();

    // Velocity keeps what was committed, even though unfinished work moved out.
    const { sprints } = await ws.owner.data<{ sprints: { id: string; totalTasks: number; doneTasks: number; committedTasks: number | null }[] }>(
      'query($w: ID!, $s: ID!) { sprints(workspaceId: $w, spaceId: $s) { id totalTasks doneTasks committedTasks } }',
      { w, s: ws.spaceId },
    );
    expect(sprints.find((item) => item.id === current)).toMatchObject({ totalTasks: 0, doneTasks: 0, committedTasks: 3 });
    expect(sprints.find((item) => item.id === next)?.committedTasks).toBeNull();
  });

  it('still needs sprint.manage', async () => {
    const ws = await createWorkspace('Rollover access');
    const member = await TestUser.signUp('Rollover member');
    await addMember(ws, member, 'Member');
    const id = (await ws.owner.data<{ createSprint: { id: string } }>(CREATE_SPRINT, { w: ws.workspaceId, s: ws.spaceId, input: { name: 'S', startDate: '2026-11-02', endDate: '2026-11-13' } })).createSprint.id;
    await ws.owner.data('mutation($w: ID!, $s: ID!) { startSprint(workspaceId: $w, sprintId: $s) { id } }', { w: ws.workspaceId, s: id });
    expect((await member.error(COMPLETE, { w: ws.workspaceId, s: id, rollover: { moves: [] } })).code).toBe('FORBIDDEN');
  });
});
