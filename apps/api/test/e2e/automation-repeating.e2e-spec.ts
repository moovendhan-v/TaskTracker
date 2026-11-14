import type pg from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { runtimeDatabase } from './support/database.js';
import { createWorkspace, type WorkspaceFixture } from './support/fixtures.js';

const CREATE = 'mutation($w: ID!, $s: ID!, $input: SaveAutomationInput!) { createAutomation(workspaceId: $w, spaceId: $s, input: $input) { id trigger { type schedule { frequency time timeZone weekdays monthDay } } } }';
const DELETE = 'mutation($w: ID!, $r: ID!) { deleteAutomation(workspaceId: $w, ruleId: $r) }';
const RUNS = 'query($w: ID!, $r: ID!) { automationRuns(workspaceId: $w, ruleId: $r) { status message taskId } }';
const CREATE_TASK = 'mutation($w: ID!, $l: ID!, $input: CreateTaskInput!) { createTask(workspaceId: $w, listId: $l, input: $input) { id } }';
const UPDATE_TASK = 'mutation($w: ID!, $t: ID!, $input: UpdateTaskInput!) { updateTask(workspaceId: $w, taskId: $t, input: $input) { id } }';
const COMMENTS = 'query($w: ID!, $t: ID!) { comments(workspaceId: $w, taskId: $t) { body } }';
const CREATE_SPRINT = 'mutation($w: ID!, $s: ID!, $input: CreateSprintInput!) { createSprint(workspaceId: $w, spaceId: $s, input: $input) { id } }';

/** Polls until `check` returns a value (the scheduler ticks every second in tests). */
async function eventually<T>(check: () => Promise<T | undefined>, timeoutMs = 15_000): Promise<T> {
  const until = Date.now() + timeoutMs;
  for (;;) {
    const value = await check();
    if (value !== undefined) return value;
    if (Date.now() > until) throw new Error('Timed out waiting for the scheduler');
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
}

const comment = (message: string) => [{ type: 'comment', message }];
const weekdayNow = () => new Date().getUTCDay();

describe('repeating schedules and sprint triggers', () => {
  let ws: WorkspaceFixture;
  let w: string;
  let db: pg.Pool;
  const create = async (input: Record<string, unknown>) => (await ws.owner.data<{ createAutomation: { id: string; trigger: { schedule: Record<string, unknown> | null } } }>(CREATE, { w, s: ws.spaceId, input })).createAutomation;
  const newTask = async (input: Record<string, unknown>) => (await ws.owner.data<{ createTask: { id: string } }>(CREATE_TASK, { w, l: ws.listId, input })).createTask.id;
  const commentsOn = async (taskId: string) => (await ws.owner.data<{ comments: { body: string }[] }>(COMMENTS, { w, t: taskId })).comments.map((entry) => entry.body);
  const runsOf = async (ruleId: string) => (await ws.owner.data<{ automationRuns: { status: string; message: string; taskId: string }[] }>(RUNS, { w, r: ruleId })).automationRuns;

  /** As if the rule was saved yesterday, so today's run time counts. */
  async function savedYesterday(ruleId: string): Promise<void> {
    const client = await db.connect();
    try {
      await client.query('BEGIN');
      await client.query("SELECT set_config('app.workspace_id', $1, true)", [w]);
      await client.query(`UPDATE automation_rule SET updated_at = now() - interval '1 day' WHERE id = $1`, [ruleId]);
      await client.query('COMMIT');
    } finally {
      client.release();
    }
  }

  beforeAll(async () => {
    db = runtimeDatabase();
    ws = await createWorkspace('Repeating owner');
    w = ws.workspaceId;
  });

  afterAll(async () => {
    await db.end();
  });

  it('checks schedules: a real time and time zone, and the days each frequency needs', async () => {
    const bad = async (schedule: Record<string, unknown> | null) => (await ws.owner.error(CREATE, { w, s: ws.spaceId, input: { name: 'Bad', trigger: { type: 'on_schedule', schedule }, actions: comment('x') } })).message;
    expect(await bad(null)).toMatch(/how often/);
    expect(await bad({ frequency: 'daily', time: '25:00', timeZone: 'UTC' })).toMatch(/HH:MM/);
    expect(await bad({ frequency: 'daily', time: '09:00', timeZone: 'Mars/Olympus' })).toMatch(/time zone/);
    expect(await bad({ frequency: 'weekly', time: '09:00', timeZone: 'UTC', weekdays: [] })).toMatch(/day of the week/);
    expect(await bad({ frequency: 'monthly', time: '09:00', timeZone: 'UTC' })).toMatch(/day of the month/);
    // Only what the frequency uses is kept.
    const saved = await create({ name: 'Mondays', enabled: false, trigger: { type: 'on_schedule', schedule: { frequency: 'weekly', time: '09:30', timeZone: 'Europe/Berlin', weekdays: [3, 1, 1], monthDay: 5 } }, actions: comment('x') });
    expect(saved.trigger.schedule).toEqual({ frequency: 'weekly', time: '09:30', timeZone: 'Europe/Berlin', weekdays: [1, 3], monthDay: null });
  });

  it('runs on schedule for each matching open task, once per day', async () => {
    const bug = await newTask({ title: 'Flaky login', type: 'bug' });
    const feature = await newTask({ title: 'Dark mode', type: 'feature' });
    const fixed = await newTask({ title: 'Old bug', type: 'bug' });
    await ws.owner.data(UPDATE_TASK, { w, t: fixed, input: { statusId: ws.statuses['Done'] } });

    // Today is a run day at 00:00 UTC; another weekday's rule doesn't run.
    const daily = await create({ name: 'Daily bug nudge', trigger: { type: 'on_schedule', schedule: { frequency: 'daily', time: '00:00', timeZone: 'UTC' } }, conditions: { types: ['bug'] }, actions: comment('Still open: {{task}}') });
    const otherDay = await create({ name: 'Not today', trigger: { type: 'on_schedule', schedule: { frequency: 'weekly', time: '00:00', timeZone: 'UTC', weekdays: [(weekdayNow() + 3) % 7] } }, actions: comment('Wrong day') });
    // Saved just now, after today's 00:00: nothing until the next run day.
    await new Promise((resolve) => setTimeout(resolve, 2_500));
    expect(await commentsOn(bug)).toEqual([]);

    await savedYesterday(daily.id);
    await savedYesterday(otherDay.id);
    const bodies = await eventually(async () => {
      const found = await commentsOn(bug);
      return found.length ? found : undefined;
    });
    expect(bodies[0]).toMatch(/^Still open: #\d+ Flaky login$/);
    // Only open bugs; and a few more ticks don't run it again today.
    await new Promise((resolve) => setTimeout(resolve, 2_500));
    expect(await commentsOn(bug)).toHaveLength(1);
    expect(await commentsOn(feature)).toEqual([]);
    expect(await commentsOn(fixed)).toEqual([]);
    expect((await runsOf(daily.id)).map((run) => run.taskId)).toEqual([bug]);
    expect(await runsOf(otherDay.id)).toEqual([]);
    await ws.owner.data(DELETE, { w, r: daily.id });
    await ws.owner.data(DELETE, { w, r: otherDay.id });
  });

  it('runs for each task in a sprint when it starts and when it completes', async () => {
    const started = await create({ name: 'Kick-off', trigger: { type: 'sprint_started' }, actions: comment('In {{sprint}}: {{task}}') });
    const ended = await create({ name: 'Wrap-up', trigger: { type: 'sprint_completed' }, conditions: { types: ['bug'] }, actions: comment('{{sprint}} ended with this {{status}}') });
    const sprint = (await ws.owner.data<{ createSprint: { id: string } }>(CREATE_SPRINT, { w, s: ws.spaceId, input: { name: 'Sprint 12', startDate: '2026-11-16', endDate: '2026-11-27' } })).createSprint.id;
    const a = await newTask({ title: 'Ship search', type: 'feature' });
    const b = await newTask({ title: 'Search crash', type: 'bug' });
    const outside = await newTask({ title: 'Not planned', type: 'bug' });
    for (const id of [a, b]) await ws.owner.data(UPDATE_TASK, { w, t: id, input: { sprintId: sprint } });

    await ws.owner.data('mutation($w: ID!, $s: ID!) { startSprint(workspaceId: $w, sprintId: $s) { id } }', { w, s: sprint });
    expect((await commentsOn(a))[0]).toMatch(/^In Sprint 12: #\d+ Ship search$/);
    expect((await commentsOn(b))[0]).toMatch(/^In Sprint 12: #\d+ Search crash$/);
    expect(await commentsOn(outside)).toEqual([]);

    await ws.owner.data(UPDATE_TASK, { w, t: a, input: { statusId: ws.statuses['Done'] } });
    await ws.owner.data('mutation($w: ID!, $s: ID!) { completeSprint(workspaceId: $w, sprintId: $s) { status } }', { w, s: sprint });
    // Only bugs, including the unfinished one that just went back to the backlog.
    expect(await commentsOn(b)).toContainEqual(expect.stringMatching(/^Sprint 12 ended with this To do$/i));
    expect(await commentsOn(a)).toHaveLength(1);
    expect(await commentsOn(outside)).toEqual([]);
    expect((await runsOf(started.id)).map((run) => run.status)).toEqual(['succeeded', 'succeeded']);
    expect((await runsOf(ended.id)).map((run) => run.taskId)).toEqual([b]);
  });
});
