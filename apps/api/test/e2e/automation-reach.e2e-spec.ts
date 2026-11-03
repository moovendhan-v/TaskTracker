import { createHmac } from 'node:crypto';
import { createServer, type IncomingHttpHeaders, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { TestUser } from './support/api-client.js';
import { addMember, createWorkspace, type WorkspaceFixture } from './support/fixtures.js';

const CREATE = 'mutation($w: ID!, $s: ID!, $input: SaveAutomationInput!) { createAutomation(workspaceId: $w, spaceId: $s, input: $input) { id } }';
const RUNS = 'query($w: ID!, $r: ID!) { automationRuns(workspaceId: $w, ruleId: $r) { status message taskId trace { stepId outcome detail } } }';
const REVEAL = 'mutation($w: ID!, $r: ID!, $rotate: Boolean!) { revealAutomationWebhookSecret(workspaceId: $w, ruleId: $r, rotate: $rotate) }';
const PREVIEW = 'query($w: ID!, $s: ID!, $t: ID!, $input: SaveAutomationInput!) { previewAutomation(workspaceId: $w, spaceId: $s, taskId: $t, input: $input) { stepId outcome detail } }';
const CREATE_TASK = 'mutation($w: ID!, $l: ID!, $input: CreateTaskInput!) { createTask(workspaceId: $w, listId: $l, input: $input) { id } }';
const TASK = 'query($w: ID!, $t: ID!) { task(workspaceId: $w, taskId: $t) { priority } }';
const CHANNEL = 'mutation($w: ID!, $input: CreateChatChannelInput!) { createChatChannel(workspaceId: $w, input: $input) { id } }';
const MESSAGES = 'query($w: ID!, $c: ID!) { chatMessages(workspaceId: $w, channelId: $c) { items { body authorId } } }';
const AUDIT = 'query($w: ID!, $q: ResourceQueryInput) { searchWorkspaceAuditLog(workspaceId: $w, query: $q) { items { action } } }';

interface Received {
  headers: IncomingHttpHeaders;
  body: string;
}

async function eventually<T>(check: () => Promise<T | undefined>, timeoutMs = 15_000): Promise<T> {
  const until = Date.now() + timeoutMs;
  for (;;) {
    const value = await check();
    if (value !== undefined) return value;
    if (Date.now() > until) throw new Error('Timed out waiting');
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
}

/** E1 phase 3: chat posts, webhooks (signed, after commit, with retries) and test runs. */
describe('automations that reach out', () => {
  let ws: WorkspaceFixture;
  let member: TestUser;
  let w: string;
  let receiver: Server;
  let port: number;
  const received: Received[] = [];
  let failNext = 0;
  const create = async (input: Record<string, unknown>) => (await ws.owner.data<{ createAutomation: { id: string } }>(CREATE, { w, s: ws.spaceId, input })).createAutomation.id;
  const newTask = async (input: Record<string, unknown>) => (await member.data<{ createTask: { id: string } }>(CREATE_TASK, { w, l: ws.listId, input })).createTask.id;
  const runsOf = async (ruleId: string) => (await ws.owner.data<{ automationRuns: { status: string; taskId: string; trace: { stepId: string; outcome: string; detail: string }[] }[] }>(RUNS, { w, r: ruleId })).automationRuns;
  const flowWith = (...steps: unknown[]) => ({ name: 'Reach', trigger: { type: 'task_created' }, actions: [], flowJson: JSON.stringify({ steps }) });

  beforeAll(async () => {
    ws = await createWorkspace('Reach owner');
    w = ws.workspaceId;
    member = await TestUser.signUp('Reach member');
    await addMember(ws, member, 'Member');
    receiver = createServer((request, response) => {
      let body = '';
      request.on('data', (chunk: Buffer) => (body += chunk.toString()));
      request.on('end', () => {
        received.push({ headers: request.headers, body });
        if (failNext > 0) {
          failNext -= 1;
          response.statusCode = 503;
        }
        response.end('ignored');
      });
    });
    await new Promise<void>((resolve) => receiver.listen(0, '127.0.0.1', resolve));
    port = (receiver.address() as AddressInfo).port;
  });

  afterAll(async () => {
    await new Promise((resolve) => receiver.close(resolve));
  });

  it('calls a webhook after the change commits, signed with the rule’s secret', async () => {
    const url = `http://127.0.0.1:${port}/hooks/tasks`;
    const ruleId = await create(flowWith({ id: 'hook', kind: 'action', action: { type: 'webhook', url } }));
    const secret = (await ws.owner.data<{ revealAutomationWebhookSecret: string }>(REVEAL, { w, r: ruleId, rotate: false })).revealAutomationWebhookSecret;
    expect(secret.length).toBeGreaterThanOrEqual(40);

    const taskId = await newTask({ title: 'Ship the webhook' });
    const call = await eventually(async () => received.find((item) => item.body.includes(taskId)));
    const payload = JSON.parse(call.body);
    expect(payload).toMatchObject({ event: 'automation.webhook', automation: { id: ruleId }, task: { id: taskId, title: 'Ship the webhook' } });
    const timestamp = call.headers['x-taskflow-timestamp'] as string;
    expect(call.headers['x-taskflow-signature']).toBe(`sha256=${createHmac('sha256', secret).update(`${timestamp}.${call.body}`).digest('hex')}`);
    expect(call.headers['x-taskflow-delivery']).toMatch(/^[0-9a-f-]{36}$/);

    // The run's trace says how the delivery went.
    const run = await eventually(async () => (await runsOf(ruleId)).find((item) => item.taskId === taskId && item.trace[0]?.detail.startsWith('Sent')));
    expect(run.trace[0]).toMatchObject({ stepId: 'hook', outcome: 'ran', detail: 'Sent (HTTP 200)' });

    // Revealing the secret is audited; rotating gives a new one.
    const rotated = (await ws.owner.data<{ revealAutomationWebhookSecret: string }>(REVEAL, { w, r: ruleId, rotate: true })).revealAutomationWebhookSecret;
    expect(rotated).not.toBe(secret);
    const audit = (await ws.owner.data<{ searchWorkspaceAuditLog: { items: { action: string }[] } }>(AUDIT, { w, q: { where: 'action[starts_with]=automation.webhook_secret' } })).searchWorkspaceAuditLog.items.map((item) => item.action);
    expect(audit).toEqual(expect.arrayContaining(['automation.webhook_secret.reveal', 'automation.webhook_secret.rotate']));
    expect((await member.error(REVEAL, { w, r: ruleId, rotate: false })).code).toBe('FORBIDDEN');
    await ws.owner.data('mutation($w: ID!, $r: ID!) { deleteAutomation(workspaceId: $w, ruleId: $r) }', { w, r: ruleId });
  });

  it('retries a failed delivery and says so in the trace', async () => {
    failNext = 1;
    const ruleId = await create(flowWith({ id: 'hook', kind: 'action', action: { type: 'webhook', url: `http://127.0.0.1:${port}/flaky` } }));
    const taskId = await newTask({ title: 'Flaky receiver' });
    const run = await eventually(async () => (await runsOf(ruleId)).find((item) => item.taskId === taskId && item.trace[0]?.detail.startsWith('Try 1 failed')));
    expect(run.trace[0]!.detail).toBe('Try 1 failed (HTTP 503); trying again');
    expect(run.status).toBe('succeeded');
    await ws.owner.data('mutation($w: ID!, $r: ID!) { deleteAutomation(workspaceId: $w, ruleId: $r) }', { w, r: ruleId });
  });

  it('refuses webhook URLs the server doesn’t allow', async () => {
    const bad = async (url: string) => (await ws.owner.error(CREATE, { w, s: ws.spaceId, input: flowWith({ id: 'hook', kind: 'action', action: { type: 'webhook', url } }) })).message;
    expect(await bad('https://example.org/hook')).toMatch(/isn't on this server's webhook allowlist/);
    expect(await bad('ftp://localhost/x')).toMatch(/https/);
    expect(await bad('http://user:pw@localhost/x')).toMatch(/user name/);
  });

  it('posts in a chat channel as the rule’s owner, only where they can post', async () => {
    const channel = (await ws.owner.data<{ createChatChannel: { id: string } }>(CHANNEL, { w, input: { name: 'triage-feed', kind: 'public' } })).createChatChannel.id;
    const ruleId = await create(flowWith({ id: 'post', kind: 'action', action: { type: 'post_chat', channelId: channel, message: 'New: {{task}}' } }));
    await newTask({ title: 'Printer on fire' });
    const messages = (await ws.owner.data<{ chatMessages: { items: { body: string; authorId: string }[] } }>(MESSAGES, { w, c: channel })).chatMessages.items;
    expect(messages).toEqual(expect.arrayContaining([{ body: expect.stringMatching(/^New: #\d+ Printer on fire$/), authorId: ws.owner.id }]));
    await ws.owner.data('mutation($w: ID!, $r: ID!) { deleteAutomation(workspaceId: $w, ruleId: $r) }', { w, r: ruleId });

    // A private channel the owner isn't in looks like it doesn't exist.
    const secretRoom = (await member.data<{ createChatChannel: { id: string } }>(CHANNEL, { w, input: { name: 'member-only', kind: 'private' } })).createChatChannel.id;
    const refused = await ws.owner.error(CREATE, { w, s: ws.spaceId, input: flowWith({ id: 'post', kind: 'action', action: { type: 'post_chat', channelId: secretRoom, message: 'Hi' } }) });
    expect(refused.code).toBe('NOT_FOUND');
  });

  it('test-runs a flow against a task without changing it', async () => {
    const taskId = await newTask({ title: 'Preview me', priority: 'low' });
    const input = flowWith(
      { id: 'raise', kind: 'action', action: { type: 'set_priority', priority: 'urgent' } },
      { id: 'urgent', kind: 'if', condition: { field: 'priority', priorities: ['urgent'] }, yes: [{ id: 'hook', kind: 'action', action: { type: 'webhook', url: `http://127.0.0.1:${port}/never` } }], no: [] },
    );
    const before = received.length;
    const trace = (await ws.owner.data<{ previewAutomation: { stepId: string; outcome: string }[] }>(PREVIEW, { w, s: ws.spaceId, t: taskId, input })).previewAutomation;
    expect(trace.map((entry) => `${entry.stepId}:${entry.outcome}`)).toEqual(['raise:ran', 'urgent:took-yes', 'hook:ran']);
    expect((await member.data<{ task: { priority: string } }>(TASK, { w, t: taskId })).task.priority).toBe('low');
    expect(received.length).toBe(before);
    expect((await member.error(PREVIEW, { w, s: ws.spaceId, t: taskId, input })).code).toBe('FORBIDDEN');
  });
});
