import { beforeAll, describe, expect, it } from 'vitest';
import { TestUser } from './support/api-client.js';
import { addMember, createWorkspace, type WorkspaceFixture } from './support/fixtures.js';

const ENTRY = 'id userId userName taskId task { number title } spaceId spaceName startedAt endedAt minutes note activity';

interface Entry {
  id: string;
  userId: string;
  taskId: string | null;
  spaceId: string | null;
  endedAt: string | null;
  minutes: number;
  note: string;
}

// A past week, so timers started during the run never land in it.
const at = (time: string) => `2025-03-11T${time}:00.000Z`;

describe('time tracking and dashboards', () => {
  let ws: WorkspaceFixture;
  let member: TestUser;
  let guest: TestUser;
  let taskId: string;
  let doneTaskId: string;
  const vars = (extra: Record<string, unknown> = {}) => ({ w: ws.workspaceId, ...extra });
  const log = (input: Record<string, unknown>, user: TestUser) =>
    user.gql<{ logTime: Entry }>(`mutation($w: ID!, $input: LogTimeInput!) { logTime(workspaceId: $w, input: $input) { ${ENTRY} } }`, vars({ input }));
  const entries = (query: Record<string, unknown>, user: TestUser) =>
    user.gql<{ timeEntries: Entry[] }>(`query($w: ID!, $q: TimeEntryQueryInput!) { timeEntries(workspaceId: $w, query: $q) { ${ENTRY} } }`, vars({ q: query }));
  const week = { from: '2025-03-09T00:00:00.000Z', to: '2025-03-16T00:00:00.000Z' };

  beforeAll(async () => {
    ws = await createWorkspace('Time owner');
    member = await TestUser.signUp('Time member');
    guest = await TestUser.signUp('Time guest');
    await addMember(ws, member, 'Member');
    await addMember(ws, guest, 'Guest');
    const create = 'mutation($w: ID!, $l: ID!, $input: CreateTaskInput!) { createTask(workspaceId: $w, listId: $l, input: $input) { id } }';
    taskId = (await ws.owner.data<{ createTask: { id: string } }>(create, vars({ l: ws.listId, input: { title: 'Ship the VPN', assigneeId: member.id, dueDate: '2020-01-01T00:00:00.000Z' } }))).createTask.id;
    doneTaskId = (await ws.owner.data<{ createTask: { id: string } }>(create, vars({ l: ws.listId, input: { title: 'Write notes', statusId: ws.statuses['Done'] } }))).createTask.id;
  });

  it('runs one timer per person: starting another stops the first', async () => {
    const start = `mutation($w: ID!, $input: StartTimerInput!) { startTimer(workspaceId: $w, input: $input) { ${ENTRY} } }`;
    const first = (await member.data<{ startTimer: Entry }>(start, vars({ input: { taskId } }))).startTimer;
    expect(first).toMatchObject({ taskId, spaceId: ws.spaceId, endedAt: null });
    const running = await member.data<{ runningTimer: Entry | null }>(`query($w: ID!) { runningTimer(workspaceId: $w) { id } }`, vars());
    expect(running.runningTimer?.id).toBe(first.id);

    await member.data(start, vars({ input: { spaceId: ws.spaceId, note: 'Planning' } }));
    const { stopTimer } = await member.data<{ stopTimer: Entry }>(`mutation($w: ID!) { stopTimer(workspaceId: $w) { ${ENTRY} } }`, vars());
    expect(stopTimer).toMatchObject({ taskId: null, note: 'Planning', minutes: 1 });
    expect(stopTimer.endedAt).not.toBeNull();
    expect((await member.error(`mutation($w: ID!) { stopTimer(workspaceId: $w) { id } }`, vars())).code).toBe('BAD_USER_INPUT');
  });

  it('logs time with checked spans and tasks', async () => {
    const { data } = await log({ taskId, startedAt: at('09:00'), endedAt: at('11:30'), note: 'Deployed the server', activity: 'Development' }, member);
    expect(data?.logTime).toMatchObject({ minutes: 150, note: 'Deployed the server' });

    expect((await log({ taskId, startedAt: at('11:00'), endedAt: at('10:00') }, member)).errors?.[0]?.extensions?.code).toBe('BAD_USER_INPUT');
    expect((await log({ startedAt: at('09:00'), endedAt: '2025-03-12T09:30:00.000Z' }, member)).errors?.[0]?.extensions?.code).toBe('BAD_USER_INPUT');
    const other = await createWorkspace('Time other');
    const { createTask } = await other.owner.data<{ createTask: { id: string } }>('mutation($w: ID!, $l: ID!) { createTask(workspaceId: $w, listId: $l, input: { title: "Theirs" }) { id } }', {
      w: other.workspaceId,
      l: other.listId,
    });
    expect((await log({ taskId: createTask.id, startedAt: at('09:00'), endedAt: at('10:00') }, member)).errors?.[0]?.extensions?.code).toBe('NOT_FOUND');
    expect((await log({ startedAt: at('09:00'), endedAt: at('10:00') }, guest)).errors?.[0]?.extensions?.code).toBe('FORBIDDEN');
  });

  it('saves a daily log all at once, capped at 24 hours', async () => {
    const batch = 'mutation($w: ID!, $input: LogTimeBatchInput!) { logTimeBatch(workspaceId: $w, input: $input) { minutes } }';
    const { logTimeBatch } = await ws.owner.data<{ logTimeBatch: { minutes: number }[] }>(
      batch,
      vars({ input: { entries: [{ taskId, startedAt: at('13:00'), endedAt: at('14:00') }, { taskId: doneTaskId, startedAt: at('14:00'), endedAt: at('14:45') }] } }),
    );
    expect(logTimeBatch.map((entry) => entry.minutes)).toEqual([60, 45]);
    const tooLong = Array.from({ length: 2 }, (_, i) => ({ startedAt: `2026-10-2${i + 1}T00:00:00.000Z`, endedAt: `2026-10-2${i + 1}T23:00:00.000Z` }));
    expect((await ws.owner.error(batch, vars({ input: { entries: tooLong } }))).code).toBe('BAD_USER_INPUT');

    const { taskTimeSummary } = await member.data<{ taskTimeSummary: { totalMinutes: number; myMinutes: number; entryCount: number } }>(
      'query($w: ID!, $t: ID!) { taskTimeSummary(workspaceId: $w, taskId: $t) { totalMinutes myMinutes entryCount } }',
      vars({ t: taskId }),
    );
    expect(taskTimeSummary).toEqual({ totalMinutes: 211, myMinutes: 151, entryCount: 3 });
  });

  it("shows other people's time only with time.view_all, and edits it only with time.manage", async () => {
    const own = (await entries(week, member)).data?.timeEntries ?? [];
    expect(own.length).toBeGreaterThan(0);
    expect(own.every((entry) => entry.userId === member.id)).toBe(true);
    expect((await entries({ ...week, userIds: [ws.owner.id] }, member)).errors?.[0]?.extensions?.code).toBe('FORBIDDEN');

    const everyone = (await entries(week, ws.owner)).data?.timeEntries ?? [];
    expect(new Set(everyone.map((entry) => entry.userId))).toEqual(new Set([member.id, ws.owner.id]));
    const ownersEntry = everyone.find((entry) => entry.userId === ws.owner.id)!;
    const membersEntry = own.find((entry) => entry.minutes === 150)!;

    const update = 'mutation($w: ID!, $e: ID!, $input: UpdateTimeEntryInput!) { updateTimeEntry(workspaceId: $w, entryId: $e, input: $input) { minutes note } }';
    expect((await member.error(update, vars({ e: ownersEntry.id, input: { note: 'mine now' } }))).code).toBe('NOT_FOUND');
    const { updateTimeEntry } = await ws.owner.data<{ updateTimeEntry: { minutes: number; note: string } }>(update, vars({ e: membersEntry.id, input: { endedAt: at('11:00'), note: 'Corrected' } }));
    expect(updateTimeEntry).toEqual({ minutes: 120, note: 'Corrected' });

    const audit = await ws.owner.data<{ searchWorkspaceAuditLog: { items: { action: string }[] } }>(
      'query($w: ID!) { searchWorkspaceAuditLog(workspaceId: $w, query: { where: "action[starts_with]=time_entry." }) { items { action } } }',
      vars(),
    );
    expect(audit.searchWorkspaceAuditLog.items.map((item) => item.action)).toContain('time_entry.update');
    expect((await entries({ from: week.from, to: '2027-01-01T00:00:00.000Z' }, ws.owner)).errors?.[0]?.extensions?.code).toBe('BAD_USER_INPUT');
  });

  describe('dashboard', () => {
    const DASHBOARD = `query($w: ID!, $input: DashboardInput!) { dashboard(workspaceId: $w, input: $input) {
      hoursOnlyMine summary { projects openTasks closedTasks overdue unassigned minutesLogged minutesAllTime }
      byStatus { name count } overdueAging minutesPerDay { day minutes } minutesByPerson { userId minutes }
      dueForecast { kind count } createdVsClosed { created closed } people { userId name open overdue minutes }
      projects { name open closed progress minutes } overdueTasks { title status { name } } recentlyUpdated { title } } }`;
    interface Dashboard {
      hoursOnlyMine: boolean;
      summary: Record<string, number>;
      byStatus: { name: string; count: number }[];
      overdueAging: number[];
      minutesPerDay: { day: string; minutes: number }[];
      minutesByPerson: { userId: string; minutes: number }[];
      dueForecast: { kind: string; count: number }[];
      createdVsClosed: { created: number; closed: number }[];
      people: { userId: string | null; name: string; open: number; overdue: number; minutes: number }[];
      projects: { name: string; open: number; closed: number; progress: number; minutes: number }[];
      overdueTasks: { title: string; status: { name: string } }[];
      recentlyUpdated: { title: string }[];
    }
    const input = { ...week, timeZone: 'UTC' };
    const dashboard = (user: TestUser, extra: Record<string, unknown> = {}) =>
      user.data<{ dashboard: Dashboard }>(DASHBOARD, vars({ input: { ...input, ...extra } })).then((r) => r.dashboard);

    it('counts tasks live and hours in the window, for everyone with time.view_all', async () => {
      const board = await dashboard(ws.owner);
      expect(board.hoursOnlyMine).toBe(false);
      expect(board.summary).toMatchObject({ projects: 1, openTasks: 1, closedTasks: 1, overdue: 1, unassigned: 0, minutesLogged: 225 });
      expect(board.byStatus).toEqual([{ name: 'To do', count: 1 }, { name: 'Done', count: 1 }]);
      expect(board.overdueAging[3]).toBe(1);
      expect(board.minutesPerDay).toHaveLength(7);
      expect(board.minutesPerDay.find((day) => day.day === '2025-03-11')?.minutes).toBe(225);
      expect(board.dueForecast[0]).toEqual({ kind: 'overdue', count: 1 });
      expect(board.dueForecast).toHaveLength(11);
      expect(board.createdVsClosed.reduce((sum, week) => sum + week.created, 0)).toBe(2);
      expect(board.people.find((person) => person.userId === member.id)).toMatchObject({ open: 1, overdue: 1, minutes: 120 });
      expect(board.projects[0]).toMatchObject({ name: 'Engineering', open: 1, closed: 1, progress: 50, minutes: 225 });
      expect(board.overdueTasks).toEqual([{ title: 'Ship the VPN', status: { name: 'To do' } }]);
    });

    it("shows only the caller's own hours without time.view_all", async () => {
      const board = await dashboard(member);
      expect(board.hoursOnlyMine).toBe(true);
      expect(board.summary['minutesLogged']).toBe(120);
      expect(board.minutesByPerson.map((person) => person.userId)).toEqual([member.id]);
      const mine = await dashboard(member, { userIds: [member.id] });
      expect(mine.summary).toMatchObject({ openTasks: 1, closedTasks: 0 });
    });

    it('scopes to one project and rejects bad input and other tenants', async () => {
      expect((await dashboard(ws.owner, { spaceId: ws.spaceId })).summary['projects']).toBe(1);
      expect((await ws.owner.error(DASHBOARD, vars({ input: { ...input, timeZone: "UTC'; DROP TABLE task;--" } }))).code).toBe('BAD_USER_INPUT');
      expect((await ws.owner.error(DASHBOARD, vars({ input: { ...input, timeZone: 'Mars/Olympus' } }))).code).toBe('BAD_USER_INPUT');
      const other = await createWorkspace('Dashboard other');
      expect((await other.owner.error(DASHBOARD, vars({ input }))).code).toBe('NOT_FOUND');
      expect((await ws.owner.error(DASHBOARD, vars({ input: { ...input, spaceId: other.spaceId } }))).code).toBe('NOT_FOUND');
    });
  });
});
