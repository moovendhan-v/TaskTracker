import type pg from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { TestUser } from './support/api-client.js';
import { runtimeDatabase, withScope } from './support/database.js';
import { addMember, createWorkspace, type WorkspaceFixture } from './support/fixtures.js';

const CREATE = 'mutation($w: ID!, $s: ID!, $input: SaveAutomationInput!) { createAutomation(workspaceId: $w, spaceId: $s, input: $input) { id trigger { type days } } }';
const UPDATE = 'mutation($w: ID!, $r: ID!, $input: SaveAutomationInput!) { updateAutomation(workspaceId: $w, ruleId: $r, input: $input) { id } }';
const DELETE = 'mutation($w: ID!, $r: ID!) { deleteAutomation(workspaceId: $w, ruleId: $r) }';
const RUNS = 'query($w: ID!, $r: ID!) { automationRuns(workspaceId: $w, ruleId: $r) { status message taskId resumesAt trace { stepId outcome detail } } }';
const CREATE_TASK = 'mutation($w: ID!, $l: ID!, $input: CreateTaskInput!) { createTask(workspaceId: $w, listId: $l, input: $input) { id } }';
const COMMENTS = 'query($w: ID!, $t: ID!) { comments(workspaceId: $w, taskId: $t) { body } }';

interface Run {
  status: string;
  message: string;
  taskId: string;
  resumesAt: string | null;
  trace: { stepId: string; outcome: string; detail: string }[];
}

const path = (run: Run) => run.trace.map((entry) => `${entry.stepId}:${entry.outcome}`);
const day = (offset: number) => new Date(Date.now() + offset * 86_400_000).toISOString().slice(0, 10) + 'T12:00:00.000Z';
const comment = (id: string, message: string) => ({ id, kind: 'action', action: { type: 'comment', message } });

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

describe('automation waits and scheduled triggers', () => {
  let ws: WorkspaceFixture;
  let member: TestUser;
  let w: string;
  let db: pg.Pool;
  const create = async (input: Record<string, unknown>) => (await ws.owner.data<{ createAutomation: { id: string; trigger: { type: string; days: number | null } } }>(CREATE, { w, s: ws.spaceId, input })).createAutomation;
  const newTask = async (input: Record<string, unknown>) => (await member.data<{ createTask: { id: string } }>(CREATE_TASK, { w, l: ws.listId, input })).createTask.id;
  const runsOf = async (ruleId: string) => (await ws.owner.data<{ automationRuns: Run[] }>(RUNS, { w, r: ruleId })).automationRuns;
  const commentsOn = async (taskId: string) => (await member.data<{ comments: { body: string }[] }>(COMMENTS, { w, t: taskId })).comments.map((entry) => entry.body);

  /** Makes a waiting run due now, as the clock would after the wait. Committed, in the workspace's own scope. */
  async function endWait(ruleId: string): Promise<void> {
    const client = await db.connect();
    try {
      await client.query('BEGIN');
      await client.query("SELECT set_config('app.workspace_id', $1, true)", [w]);
      const result = await client.query(`UPDATE automation_job SET run_at = now() - interval '1 second' WHERE rule_id = $1`, [ruleId]);
      expect(result.rowCount).toBe(1);
      await client.query('COMMIT');
    } finally {
      client.release();
    }
  }

  beforeAll(async () => {
    db = runtimeDatabase();
    ws = await createWorkspace('Schedule owner');
    w = ws.workspaceId;
    member = await TestUser.signUp('Schedule member');
    await addMember(ws, member, 'Member');
  });

  afterAll(async () => {
    await db.end();
  });

  it('pauses at a wait, keeps what ran, then carries on with the rest of the flow', async () => {
    const flow = {
      steps: [
        comment('before', 'Picked up'),
        { id: 'pause', kind: 'wait', minutes: 120 },
        { id: 'urgent', kind: 'if', condition: { field: 'priority', priorities: ['urgent'] }, yes: [comment('after', 'Still urgent')], no: [] },
      ],
    };
    const rule = await create({ name: 'Follow up', trigger: { type: 'task_created' }, actions: [], flowJson: JSON.stringify(flow) });
    const task = await newTask({ title: 'Payment page down', priority: 'urgent' });

    const [waiting] = await runsOf(rule.id);
    expect(waiting!.status).toBe('waiting');
    expect(waiting!.message).toBe('Waiting 2 hours');
    expect(new Date(waiting!.resumesAt!).getTime()).toBeGreaterThan(Date.now() + 100 * 60_000);
    expect(path(waiting!)).toEqual(['before:ran', 'pause:waited']);
    expect(await commentsOn(task)).toEqual(['Picked up']);

    await endWait(rule.id);
    const done = await eventually(async () => (await runsOf(rule.id)).find((run) => run.status !== 'waiting'));
    expect(done.status).toBe('succeeded');
    expect(done.resumesAt).toBeNull();
    expect(path(done)).toEqual(['before:ran', 'pause:waited', 'urgent:took-yes', 'after:ran']);
    expect(await commentsOn(task)).toEqual(['Picked up', 'Still urgent']);
    // One run, updated in place, and the job is gone.
    expect(await runsOf(rule.id)).toHaveLength(1);
    await ws.owner.data(DELETE, { w, r: rule.id });
  });

  it('drops a waiting run when the flow changed meanwhile', async () => {
    const flow = (text: string) => ({ steps: [{ id: 'pause', kind: 'wait', minutes: 60 }, comment('later', text)] });
    const rule = await create({ name: 'Changes', trigger: { type: 'task_created' }, actions: [], flowJson: JSON.stringify(flow('First version')) });
    const task = await newTask({ title: 'Edited while waiting' });
    await ws.owner.data(UPDATE, { w, r: rule.id, input: { name: 'Changes', trigger: { type: 'task_created' }, actions: [], flowJson: JSON.stringify(flow('Second version')) } });

    await endWait(rule.id);
    const skipped = await eventually(async () => (await runsOf(rule.id)).find((run) => run.status !== 'waiting'));
    expect(skipped.status).toBe('skipped');
    expect(skipped.message).toMatch(/changed while this run was waiting/);
    expect(await commentsOn(task)).toEqual([]);
    await ws.owner.data(DELETE, { w, r: rule.id });
  });

  it('fires overdue and due-soon rules once per task and due date', async () => {
    const overdue = await create({ name: 'Overdue', trigger: { type: 'task_overdue' }, actions: [{ type: 'comment', message: 'Overdue: {{task}}' }] });
    const soon = await create({ name: 'Soon', trigger: { type: 'task_due_soon', days: 2 }, actions: [{ type: 'comment', message: 'Due soon' }] });
    expect(soon.trigger).toEqual({ type: 'task_due_soon', days: 2 });

    const late = await newTask({ title: 'Late report', dueDate: day(-1) });
    const tomorrow = await newTask({ title: 'Tomorrow', dueDate: day(1) });
    const far = await newTask({ title: 'Next month', dueDate: day(20) });

    const lateRun = await eventually(async () => (await runsOf(overdue.id)).find((run) => run.taskId === late));
    expect(lateRun.status).toBe('succeeded');
    await eventually(async () => (await runsOf(soon.id)).find((run) => run.taskId === tomorrow));
    // A few more ticks: still exactly one fire each, and nothing for tasks outside the window.
    await new Promise((resolve) => setTimeout(resolve, 2_500));
    expect((await runsOf(overdue.id)).map((run) => run.taskId)).toEqual([late]);
    expect((await runsOf(soon.id)).map((run) => run.taskId)).toEqual([tomorrow]);
    expect(await commentsOn(late)).toEqual([expect.stringMatching(/^Overdue: #\d+ Late report$/)]);
    expect(await commentsOn(far)).toEqual([]);

    // Fires and jobs are tenant rows: another workspace's scope sees none of them.
    const other = await createWorkspace('Schedule other');
    const seen = await withScope(db, { workspaceId: other.workspaceId }, async (client) => (await client.query('SELECT count(*)::int AS n FROM automation_fire')).rows[0].n);
    expect(seen).toBe(0);
  });

  it('checks the due-soon window', async () => {
    const error = await ws.owner.error(CREATE, { w, s: ws.spaceId, input: { name: 'Bad', trigger: { type: 'task_due_soon', days: 99 }, actions: [{ type: 'unassign' }] } });
    expect(error.message).toMatch(/30|days/);
  });
});
