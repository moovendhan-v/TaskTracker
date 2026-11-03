import { beforeAll, describe, expect, it } from 'vitest';
import { TestUser } from './support/api-client.js';
import { addMember, createWorkspace, type WorkspaceFixture } from './support/fixtures.js';

const SAVE = 'mutation($w: ID!, $input: SaveLayoutInput!) { saveLayout(workspaceId: $w, input: $input) { version } }';
const GET = 'query($w: ID!, $p: String!) { myLayout(workspaceId: $w, pageKey: $p) { items { id config { limit mine priorities fields } } } }';
const CREATE_TASK = 'mutation($w: ID!, $l: ID!, $input: CreateTaskInput!) { createTask(workspaceId: $w, listId: $l, input: $input) { id } }';
const DASHBOARD = 'query($w: ID!, $input: DashboardInput!) { dashboard(workspaceId: $w, input: $input) { summary { openTasks } overdueTasks { title priority assigneeName } } }';

interface Board {
  summary: { openTasks: number };
  overdueTasks: { title: string; priority: string; assigneeName: string | null }[];
}

/** B3 depth: task-list blocks narrow by "mine" and priority on the server, and pick their columns. */
describe('task-list block filters and fields', () => {
  let ws: WorkspaceFixture;
  let member: TestUser;
  let w: string;
  const input = { from: '2026-01-01T00:00:00.000Z', to: '2026-12-31T00:00:00.000Z', timeZone: 'UTC' };
  const board = (user: TestUser, extra: Record<string, unknown> = {}) => user.data<{ dashboard: Board }>(DASHBOARD, { w, input: { ...input, ...extra } }).then((result) => result.dashboard);
  const titles = (value: Board) => value.overdueTasks.map((task) => task.title).sort();

  beforeAll(async () => {
    ws = await createWorkspace('Filter owner');
    w = ws.workspaceId;
    member = await TestUser.signUp('Filter member');
    await addMember(ws, member, 'Member');
    const past = new Date(Date.now() - 3 * 86_400_000).toISOString();
    const task = (title: string, priority: string, assigneeId: string | null) => ws.owner.data(CREATE_TASK, { w, l: ws.listId, input: { title, priority, assigneeId, dueDate: past } });
    await task('Owner urgent', 'urgent', ws.owner.id);
    await task('Owner low', 'low', ws.owner.id);
    await task('Member urgent', 'urgent', member.id);
    await task('Nobody high', 'high', null);
  });

  it('narrows to the caller’s own tasks from the session, whatever ids are sent', async () => {
    expect(titles(await board(member, { mine: true }))).toEqual(['Member urgent']);
    // Naming someone else alongside mine changes nothing: "mine" is the session's user.
    expect(titles(await board(member, { mine: true, userIds: [ws.owner.id] }))).toEqual(['Member urgent']);
    expect(titles(await board(ws.owner, { mine: true }))).toEqual(['Owner low', 'Owner urgent']);
  });

  it('narrows the task lists by priority, and says each task’s priority', async () => {
    const urgent = await board(ws.owner, { priorities: ['urgent'] });
    expect(titles(urgent)).toEqual(['Member urgent', 'Owner urgent']);
    expect(urgent.overdueTasks.every((task) => task.priority === 'urgent')).toBe(true);
    // Counts stay the page's: the filter is the list's.
    expect(urgent.summary.openTasks).toBe(4);
    expect(titles(await board(ws.owner, { mine: true, priorities: ['urgent', 'high'] }))).toEqual(['Owner urgent']);
    expect((await ws.owner.error(DASHBOARD, { w, input: { ...input, priorities: ['huge'] } })).message).toMatch(/does not exist in "TaskPriority" enum/);
  });

  it('stores filters and columns per task-list block, and checks them', async () => {
    const config = { limit: 5, mine: true, priorities: ['urgent', 'high'], fields: ['number', 'priority', 'date'] };
    await ws.owner.data(SAVE, { w, input: { pageKey: 'project', baseVersion: null, items: [{ id: 'overdue-tasks', type: 'overdue-tasks', x: 0, y: 0, w: 6, h: 7, config }] } });
    const stored = (await ws.owner.data<{ myLayout: { items: { config: Record<string, unknown> }[] } }>(GET, { w, p: 'project' })).myLayout.items[0]!.config;
    expect(stored).toEqual(config);

    const bad = (type: string, value: Record<string, unknown>) => ws.owner.error(SAVE, { w, input: { pageKey: 'home', baseVersion: null, items: [{ id: type, type, x: 0, y: 0, w: 4, h: 7, config: value }] } });
    expect((await bad('status', { mine: true })).message).toMatch(/mine isn't a setting/);
    expect((await bad('recent-tasks', { fields: ['status', 'status'] })).message).toMatch(/unique/);
    expect((await bad('recent-tasks', { fields: ['salary'] })).message).toMatch(/Choose one of/);
  });
});
