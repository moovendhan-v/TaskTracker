import { beforeAll, describe, expect, it } from 'vitest';
import { TestUser } from './support/api-client.js';
import { addMember, createWorkspace, type WorkspaceFixture } from './support/fixtures.js';

const CREATE = 'mutation($w: ID!, $s: ID!, $input: SaveAutomationInput!) { createAutomation(workspaceId: $w, spaceId: $s, input: $input) { id name enabled createdById } }';
const RUNS = 'query($w: ID!, $r: ID!) { automationRuns(workspaceId: $w, ruleId: $r) { status message taskId } }';
const CREATE_TASK = 'mutation($w: ID!, $l: ID!, $input: CreateTaskInput!) { createTask(workspaceId: $w, listId: $l, input: $input) { id } }';
const UPDATE_TASK = 'mutation($w: ID!, $t: ID!, $input: UpdateTaskInput!) { updateTask(workspaceId: $w, taskId: $t, input: $input) { id } }';
const TASK = 'query($w: ID!, $t: ID!) { task(workspaceId: $w, taskId: $t) { priority assigneeId status { name } } }';
const INBOX = 'query($w: ID!) { notifications(workspaceId: $w) { items { kind subject excerpt } } }';

describe('automations', () => {
  let ws: WorkspaceFixture;
  let member: TestUser;
  const vars = (extra: Record<string, unknown> = {}) => ({ w: ws.workspaceId, ...extra });
  const rule = async (input: Record<string, unknown>) => (await ws.owner.data<{ createAutomation: { id: string } }>(CREATE, vars({ s: ws.spaceId, input }))).createAutomation.id;
  const newTask = async (user: TestUser, input: Record<string, unknown>) => (await user.data<{ createTask: { id: string } }>(CREATE_TASK, vars({ l: ws.listId, input }))).createTask.id;

  beforeAll(async () => {
    ws = await createWorkspace('Automation owner');
    member = await TestUser.signUp('Automation member');
    await addMember(ws, member, 'Member');
  });

  it('needs automation.manage', async () => {
    const result = await member.error(CREATE, vars({ s: ws.spaceId, input: { name: 'x', trigger: { type: 'task_created' }, actions: [{ type: 'unassign' }] } }));
    expect(result.code).toBe('FORBIDDEN');
  });

  it('validates rules: actions need what they point at', async () => {
    const bad = (input: Record<string, unknown>) => ws.owner.error(CREATE, vars({ s: ws.spaceId, input: { name: 'Bad', trigger: { type: 'task_created' }, ...input } }));
    expect((await bad({ actions: [] })).message).toMatch(/at least one/);
    expect((await bad({ actions: [{ type: 'notify', audiences: ['assignee'] }] })).message).toMatch(/message/);
    const stranger = await TestUser.signUp('Not a member');
    expect((await bad({ actions: [{ type: 'assign', userId: stranger.id }] })).message).toMatch(/members/);
  });

  it('acts when a task is created and when its status changes, and notifies people', async () => {
    await rule({ name: 'Bugs are urgent', trigger: { type: 'task_created' }, conditions: { types: ['bug'] }, actions: [{ type: 'set_priority', priority: 'urgent' }, { type: 'assign', userId: member.id }] });
    const bug = await newTask(member, { title: 'Crash on save', type: 'bug' });
    const plain = await newTask(member, { title: 'Write docs' });
    expect((await ws.owner.data<{ task: { priority: string; assigneeId: string } }>(TASK, vars({ t: bug }))).task).toMatchObject({ priority: 'urgent', assigneeId: member.id });
    expect((await ws.owner.data<{ task: { priority: string } }>(TASK, vars({ t: plain }))).task.priority).toBe('none');

    const notifyId = await rule({
      name: 'Tell the creator',
      trigger: { type: 'task_status_changed', categories: ['done'] },
      actions: [{ type: 'notify', audiences: ['creator'], message: '{{task}} is {{status}} (by {{actor}})' }],
    });
    await ws.owner.data(UPDATE_TASK, vars({ t: plain, input: { statusId: ws.statuses['Done'] } }));
    const { notifications } = await member.data<{ notifications: { items: { kind: string; subject: string; excerpt: string }[] } }>(INBOX, vars());
    const sent = notifications.items.find((item) => item.kind === 'automation');
    expect(sent?.subject).toMatch(/Write docs is Done \(by Automation owner\)/);
    expect(sent?.excerpt).toBe('Tell the creator');
    expect((await ws.owner.data<{ automationRuns: { status: string }[] }>(RUNS, vars({ r: notifyId }))).automationRuns[0]?.status).toBe('succeeded');
  });

  it("logs a failed rule without undoing the user's change, and changes made by rules don't trigger rules", async () => {
    const { createStatus } = await ws.owner.data<{ createStatus: { id: string } }>(
      'mutation($w: ID!, $s: ID!) { createStatus(workspaceId: $w, spaceId: $s, input: { name: "Triage", color: "#ef4444", category: unstarted }) { id } }',
      vars({ s: ws.spaceId }),
    );
    const failing = await rule({ name: 'Send to triage', trigger: { type: 'task_priority_changed', priorities: ['high'] }, actions: [{ type: 'set_priority', priority: 'low' }, { type: 'set_status', statusId: createStatus.id }] });
    // Deleting the status makes the rule's second action fail.
    await ws.owner.data('mutation($w: ID!, $s: ID!, $to: ID!) { deleteStatus(workspaceId: $w, statusId: $s, moveTasksTo: $to) }', vars({ s: createStatus.id, to: ws.statuses['To do'] }));
    // A loop guard: this rule would flip priority back to high forever if rules triggered rules.
    await rule({ name: 'Ping-pong', trigger: { type: 'task_priority_changed', priorities: ['low'] }, actions: [{ type: 'set_priority', priority: 'high' }] });

    const task = await newTask(ws.owner, { title: 'Payments down' });
    await ws.owner.data(UPDATE_TASK, vars({ t: task, input: { priority: 'high', title: 'Payments are down' } }));
    // The user's change stays; the failed rule's first action was rolled back with it.
    expect((await ws.owner.data<{ task: { priority: string } }>(TASK, vars({ t: task }))).task.priority).toBe('high');
    const { automationRuns } = await ws.owner.data<{ automationRuns: { status: string; message: string }[] }>(RUNS, vars({ r: failing }));
    expect(automationRuns[0]).toMatchObject({ status: 'failed' });
    expect(automationRuns[0]?.message).toMatch(/Status/);
  });

  it('runs as its creator and skips once they lose what it needs', async () => {
    const outsider = await TestUser.signUp('Rule maker');
    await addMember(ws, outsider, 'Admin');
    const { createAutomation } = await outsider.data<{ createAutomation: { id: string } }>(
      CREATE,
      vars({ s: ws.spaceId, input: { name: 'Admin rule', trigger: { type: 'task_created' }, actions: [{ type: 'set_priority', priority: 'low' }] } }),
    );
    const { members } = await ws.owner.data<{ members: { userId: string }[] }>('query($w: ID!) { members(workspaceId: $w) { userId } }', vars());
    expect(members.map((m) => m.userId)).toContain(outsider.id);
    await ws.owner.data('mutation($w: ID!, $u: ID!) { removeMember(workspaceId: $w, userId: $u) }', vars({ u: outsider.id }));
    await newTask(ws.owner, { title: 'After they left' });
    const { automationRuns } = await ws.owner.data<{ automationRuns: { status: string; message: string }[] }>(RUNS, vars({ r: createAutomation.id }));
    expect(automationRuns[0]).toMatchObject({ status: 'skipped' });
  });
});
