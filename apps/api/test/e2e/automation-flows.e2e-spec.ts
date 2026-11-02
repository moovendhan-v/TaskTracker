import { beforeAll, describe, expect, it } from 'vitest';
import { TestUser } from './support/api-client.js';
import { addMember, createWorkspace, type WorkspaceFixture } from './support/fixtures.js';

const CREATE = 'mutation($w: ID!, $s: ID!, $input: SaveAutomationInput!) { createAutomation(workspaceId: $w, spaceId: $s, input: $input) { id flowJson actions { type } } }';
const RUNS = 'query($w: ID!, $r: ID!) { automationRuns(workspaceId: $w, ruleId: $r) { status message taskId trace { stepId outcome detail } } }';
const CREATE_TASK = 'mutation($w: ID!, $l: ID!, $input: CreateTaskInput!) { createTask(workspaceId: $w, listId: $l, input: $input) { id } }';
const TASK = 'query($w: ID!, $t: ID!) { task(workspaceId: $w, taskId: $t) { dueDate } }';
const COMMENTS = 'query($w: ID!, $t: ID!) { comments(workspaceId: $w, taskId: $t) { body authorId } }';
const WATCHERS = 'query($w: ID!, $t: ID!) { taskWatchers(workspaceId: $w, taskId: $t) }';

interface Run {
  status: string;
  message: string;
  taskId: string;
  trace: { stepId: string; outcome: string; detail: string }[];
}

describe('automation flows', () => {
  let ws: WorkspaceFixture;
  let member: TestUser;
  let w: string;
  const create = (input: Record<string, unknown>) => ws.owner.data<{ createAutomation: { id: string; flowJson: string | null; actions: { type: string }[] } }>(CREATE, { w, s: ws.spaceId, input });
  const newTask = async (input: Record<string, unknown>) => (await member.data<{ createTask: { id: string } }>(CREATE_TASK, { w, l: ws.listId, input })).createTask.id;
  const runsOf = async (ruleId: string) => (await ws.owner.data<{ automationRuns: Run[] }>(RUNS, { w, r: ruleId })).automationRuns;

  beforeAll(async () => {
    ws = await createWorkspace('Flow owner');
    w = ws.workspaceId;
    member = await TestUser.signUp('Flow member');
    await addMember(ws, member, 'Member');
  });

  it('runs a branching flow and traces the path each run took', async () => {
    const flow = {
      steps: [
        {
          id: 'urgent',
          kind: 'if',
          condition: { field: 'priority', priorities: ['urgent'] },
          yes: [
            { id: 'comment', kind: 'action', action: { type: 'comment', message: 'Triage {{task}} today' } },
            { id: 'due', kind: 'action', action: { type: 'set_due_date', days: 2 } },
          ],
          no: [
            {
              id: 'docs',
              kind: 'if',
              condition: { field: 'title', contains: 'DOCS' },
              yes: [{ id: 'watch', kind: 'action', action: { type: 'add_watcher', userId: ws.owner.id } }],
              no: [{ id: 'stop', kind: 'stop' }],
            },
          ],
        },
      ],
    };
    const saved = (await create({ name: 'Triage', trigger: { type: 'task_created' }, actions: [], flowJson: JSON.stringify(flow) })).createAutomation;
    expect(JSON.parse(saved.flowJson!).steps[0].id).toBe('urgent');
    expect(saved.actions.map((action) => action.type)).toEqual(['comment', 'set_due_date', 'add_watcher']);

    const urgent = await newTask({ title: 'Login crash', priority: 'urgent' });
    const docs = await newTask({ title: 'Update the docs page' });
    const other = await newTask({ title: 'Something else' });

    const comments = (await member.data<{ comments: { body: string; authorId: string }[] }>(COMMENTS, { w, t: urgent })).comments;
    expect(comments).toEqual([{ body: expect.stringMatching(/^Triage #\d+ Login crash today$/), authorId: ws.owner.id }]);
    expect((await member.data<{ task: { dueDate: string } }>(TASK, { w, t: urgent })).task.dueDate).toBeTruthy();
    expect((await member.data<{ taskWatchers: string[] }>(WATCHERS, { w, t: docs })).taskWatchers).toContain(ws.owner.id);

    const runs = await runsOf(saved.id);
    const path = (taskId: string) => runs.find((run) => run.taskId === taskId)!.trace.map((entry) => `${entry.stepId}:${entry.outcome}`);
    expect(path(urgent)).toEqual(['urgent:took-yes', 'comment:ran', 'due:ran']);
    expect(path(docs)).toEqual(['urgent:took-no', 'docs:took-yes', 'watch:ran']);
    expect(path(other)).toEqual(['urgent:took-no', 'docs:took-no', 'stop:stopped']);
    expect(runs.every((run) => run.status === 'succeeded')).toBe(true);
  });

  it('refuses broken flows and ids from elsewhere', async () => {
    const bad = (flow: unknown) => ws.owner.error(CREATE, { w, s: ws.spaceId, input: { name: 'Bad', trigger: { type: 'task_created' }, actions: [], flowJson: typeof flow === 'string' ? flow : JSON.stringify(flow) } });
    expect((await bad('{not json')).message).toMatch(/not valid JSON/);
    expect((await bad({ steps: [{ id: 'stop', kind: 'stop' }] })).message).toMatch(/at least one action/);
    expect((await bad({ steps: [{ id: 'x', kind: 'loop' }] })).message).toMatch(/unknown step/);
    expect((await bad({ steps: [{ id: 'c', kind: 'action', action: { type: 'comment', message: '' } }] })).message).toMatch(/write the comment/);
    // A list from another workspace (or space) can't be used.
    const other = await createWorkspace('Flow other');
    const foreign = { steps: [{ id: 'l', kind: 'if', condition: { field: 'list', listIds: [other.listId] }, yes: [{ id: 'u', kind: 'action', action: { type: 'unassign' } }], no: [] }] };
    expect((await bad(foreign)).message).toMatch(/lists of this space/);
    // Someone outside the workspace can't be made a watcher.
    expect((await bad({ steps: [{ id: 'w', kind: 'action', action: { type: 'add_watcher', userId: other.owner.id } }] })).message).toMatch(/members/);
  });

  it('keeps flat rules working, now with a trace', async () => {
    const id = (await create({ name: 'Flat', trigger: { type: 'task_created' }, conditions: { types: ['bug'] }, actions: [{ type: 'set_priority', priority: 'high' }] })).createAutomation.id;
    const bug = await newTask({ title: 'Flat bug', type: 'bug' });
    const run = (await runsOf(id)).find((entry) => entry.taskId === bug)!;
    expect(run.trace.map((entry) => `${entry.stepId}:${entry.outcome}`)).toEqual(['if-1:took-yes', 'action-1:ran']);
  });
});
