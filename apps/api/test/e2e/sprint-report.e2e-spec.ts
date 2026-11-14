import { describe, expect, it } from 'vitest';
import { TestUser } from './support/api-client.js';
import { runtimeDatabase, withScope } from './support/database.js';
import { addMember, createWorkspace } from './support/fixtures.js';

const CREATE_SPRINT = 'mutation($w: ID!, $s: ID!, $input: CreateSprintInput!) { createSprint(workspaceId: $w, spaceId: $s, input: $input) { id } }';
const CREATE_TASK = 'mutation($w: ID!, $l: ID!, $input: CreateTaskInput!) { createTask(workspaceId: $w, listId: $l, input: $input) { id storyPoints } }';
const UPDATE = 'mutation($w: ID!, $t: ID!, $input: UpdateTaskInput!) { updateTask(workspaceId: $w, taskId: $t, input: $input) { id storyPoints sprintId } }';
const START = 'mutation($w: ID!, $s: ID!) { startSprint(workspaceId: $w, sprintId: $s) { id startedAt } }';
const COMPLETE = 'mutation($w: ID!, $s: ID!, $next: ID) { completeSprint(workspaceId: $w, sprintId: $s, moveOpenTasksToSprintId: $next) { status committedTasks committedPoints donePoints } }';
const REPORT = `query($w: ID!, $s: ID!) { sprintReport(workspaceId: $w, sprintId: $s) {
  status hasStartSnapshot unestimated
  committed { tasks points } completed { tasks points } cancelled { tasks points } notCompleted { tasks points } added { tasks points } removed { tasks points }
  items { number title points outcome added removed movedTo } } }`;

interface Totals {
  tasks: number;
  points: number;
}
interface Report {
  status: string;
  hasStartSnapshot: boolean;
  unestimated: number;
  committed: Totals;
  completed: Totals;
  cancelled: Totals;
  notCompleted: Totals;
  added: Totals;
  removed: Totals;
  items: { number: number; title: string; points: number | null; outcome: string; added: boolean; removed: boolean; movedTo: string | null }[];
}

describe('story points and the sprint report', () => {
  it('estimates tasks in points, and reports committed vs delivered with scope changes', async () => {
    const ws = await createWorkspace('Report owner');
    const w = ws.workspaceId;
    const sprint = async (name: string, startDate: string, endDate: string) => (await ws.owner.data<{ createSprint: { id: string } }>(CREATE_SPRINT, { w, s: ws.spaceId, input: { name, startDate, endDate } })).createSprint.id;
    const current = await sprint('Sprint 7', '2026-11-02', '2026-11-13');
    const next = await sprint('Sprint 8', '2026-11-16', '2026-11-27');
    const task = async (title: string, storyPoints: number | null, sprintId: string | null = current) => {
      const id = (await ws.owner.data<{ createTask: { id: string } }>(CREATE_TASK, { w, l: ws.listId, input: { title, storyPoints } })).createTask.id;
      if (sprintId) await ws.owner.data(UPDATE, { w, t: id, input: { sprintId } });
      return id;
    };
    const update = (t: string, input: Record<string, unknown>) => ws.owner.data(UPDATE, { w, t, input });

    // Points are whole numbers from 0 to 100.
    expect((await ws.owner.error(CREATE_TASK, { w, l: ws.listId, input: { title: 'Huge', storyPoints: 101 } })).code).toBe('BAD_USER_INPUT');
    const login = await task('Login form', 5);
    const api = await task('Login API', 3);
    const docs = await task('Docs', 2);
    const spike = await task('Spike', 8);
    expect((await ws.owner.error(REPORT, { w, s: current })).message).toMatch(/starts when the sprint starts/);

    expect((await ws.owner.data<{ startSprint: { startedAt: string | null } }>(START, { w, s: current })).startSprint.startedAt).not.toBeNull();
    // Mid-sprint: one task added (no estimate yet), one taken out, one re-estimated.
    const hotfix = await task('Hotfix', null);
    await update(spike, { sprintId: null });
    await update(api, { storyPoints: 5 });
    await update(login, { statusId: ws.statuses['Done'] });
    await update(hotfix, { statusId: ws.statuses['Done'] });

    const live = (await ws.owner.data<{ sprintReport: Report }>(REPORT, { w, s: current })).sprintReport;
    expect(live).toMatchObject({ status: 'active', hasStartSnapshot: true, committed: { tasks: 4, points: 18 }, completed: { tasks: 2, points: 5 }, added: { tasks: 1, points: 0 }, removed: { tasks: 1, points: 8 }, unestimated: 1 });
    // Sprint totals in points for velocity.
    const { sprints } = await ws.owner.data<{ sprints: { id: string; totalPoints: number; donePoints: number }[] }>('query($w: ID!, $s: ID!) { sprints(workspaceId: $w, spaceId: $s) { id totalPoints donePoints } }', { w, s: ws.spaceId });
    expect(sprints.find((item) => item.id === current)).toMatchObject({ totalPoints: 12, donePoints: 5 });

    const completed = (await ws.owner.data<{ completeSprint: { committedTasks: number; committedPoints: number; donePoints: number } }>(COMPLETE, { w, s: current, next })).completeSprint;
    expect(completed).toMatchObject({ committedTasks: 4, committedPoints: 12, donePoints: 5 });
    const report = (await ws.owner.data<{ sprintReport: Report }>(REPORT, { w, s: current })).sprintReport;
    expect(report).toMatchObject({ status: 'completed', committed: { tasks: 4, points: 18 }, completed: { tasks: 2, points: 5 }, notCompleted: { tasks: 2, points: 7 }, added: { tasks: 1, points: 0 }, removed: { tasks: 1, points: 8 } });
    expect(report.items.map((item) => [item.title, item.outcome, item.added, item.removed, item.movedTo])).toEqual([
      ['Login form', 'done', false, false, null],
      ['Login API', 'open', false, false, 'Sprint 8'],
      ['Docs', 'open', false, false, 'Sprint 8'],
      ['Spike', 'open', false, true, null],
      ['Hotfix', 'done', true, false, null],
    ]);
    // Fixed once completed: later changes to the tasks don't rewrite it.
    await update(docs, { title: 'Docs (renamed)', storyPoints: 13 });
    expect((await ws.owner.data<{ sprintReport: Report }>(REPORT, { w, s: current })).sprintReport.items.find((item) => item.title.startsWith('Docs'))).toMatchObject({ title: 'Docs', points: 2 });
  });

  it('shows the report only to people who can see the space, and keeps snapshots in their workspace', async () => {
    const ws = await createWorkspace('Report access');
    const w = ws.workspaceId;
    const id = (await ws.owner.data<{ createSprint: { id: string } }>(CREATE_SPRINT, { w, s: ws.spaceId, input: { name: 'S', startDate: '2026-11-02', endDate: '2026-11-13' } })).createSprint.id;
    const t = (await ws.owner.data<{ createTask: { id: string } }>(CREATE_TASK, { w, l: ws.listId, input: { title: 'Secret plan', storyPoints: 3 } })).createTask.id;
    await ws.owner.data(UPDATE, { w, t, input: { sprintId: id } });
    await ws.owner.data(START, { w, s: id });
    const member = await TestUser.signUp('Report member');
    await addMember(ws, member, 'Member');
    expect((await member.data<{ sprintReport: Report }>(REPORT, { w, s: id })).sprintReport.committed).toEqual({ tasks: 1, points: 3 });

    const other = await createWorkspace('Report outsider');
    expect((await other.owner.error(REPORT, { w: other.workspaceId, s: id })).code).toBe('NOT_FOUND');
    const db = runtimeDatabase();
    try {
      const leaked = await withScope(db, { workspaceId: other.workspaceId, userId: other.owner.id }, async (client) => (await client.query(`SELECT count(*)::int AS n FROM sprint_task_snapshot`)).rows[0].n);
      expect(leaked).toBe(0);
    } finally {
      await db.end();
    }
  });
});
