import { createHmac, randomUUID } from 'node:crypto';
import { beforeAll, describe, expect, inject, it } from 'vitest';
import { TestUser } from './support/api-client.js';
import { addMember, createWorkspace, type WorkspaceFixture } from './support/fixtures.js';

interface Connection {
  id: string;
  webhookPath: string;
  lastDeliveryStatus: string | null;
}

const CONNECT = 'mutation($w: ID!, $input: ConnectGithubInput!) { connectGithub(workspaceId: $w, input: $input) { webhookSecret connection { id webhookPath lastDeliveryStatus } } }';
const TASK = 'query($w: ID!, $t: ID!) { task(workspaceId: $w, taskId: $t) { status { name category } } }';
const LINKS = 'query($w: ID!, $t: ID!) { taskPullRequests(workspaceId: $w, taskId: $t) { number state title url } }';

describe('GitHub integration', () => {
  let ws: WorkspaceFixture;
  let member: TestUser;
  let connection: Connection;
  let secret: string;
  let task: { id: string; number: number };
  const vars = (extra: Record<string, unknown> = {}) => ({ w: ws.workspaceId, ...extra });

  const deliver = (body: unknown, options: { event?: string; secret?: string; delivery?: string; path?: string } = {}) => {
    const raw = JSON.stringify(body);
    return fetch(`${inject('apiUrl')}${options.path ?? connection.webhookPath}`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-github-event': options.event ?? 'pull_request',
        'x-github-delivery': options.delivery ?? randomUUID(),
        'x-hub-signature-256': `sha256=${createHmac('sha256', options.secret ?? secret).update(raw).digest('hex')}`,
      },
      body: raw,
    });
  };
  const pullRequest = (action: string, extra: Record<string, unknown> = {}) => ({
    action,
    repository: { full_name: 'Acme/Web' },
    pull_request: {
      number: 17,
      title: `TF-${task.number}: fix the crash`,
      body: 'Details',
      html_url: 'https://github.com/acme/web/pull/17',
      state: 'open',
      merged: false,
      head: { ref: 'fix/crash' },
      user: { login: 'octocat' },
      ...extra,
    },
  });

  beforeAll(async () => {
    ws = await createWorkspace('GitHub owner');
    member = await TestUser.signUp('GitHub member');
    await addMember(ws, member, 'Member');
    const { createTask } = await ws.owner.data<{ createTask: { id: string; number: number } }>(
      'mutation($w: ID!, $l: ID!) { createTask(workspaceId: $w, listId: $l, input: { title: "Crash on save" }) { id number } }',
      vars({ l: ws.listId }),
    );
    task = createTask;
  });

  it('connects a repository and shows the secret once', async () => {
    expect((await member.error(CONNECT, vars({ input: { repo: 'acme/web' } }))).code).toBe('FORBIDDEN');
    expect((await ws.owner.error(CONNECT, vars({ input: { repo: 'not a repo' } }))).code).toBe('BAD_USER_INPUT');
    const { connectGithub } = await ws.owner.data<{ connectGithub: { webhookSecret: string; connection: Connection } }>(CONNECT, vars({ input: { repo: 'acme/web' } }));
    expect(connectGithub.webhookSecret).toMatch(/^[0-9a-f]{64}$/);
    connection = connectGithub.connection;
    secret = connectGithub.webhookSecret;
    const { githubConnections } = await ws.owner.data<{ githubConnections: Record<string, unknown>[] }>('query($w: ID!) { githubConnections(workspaceId: $w) { id repo } }', vars());
    expect(githubConnections).toHaveLength(1);
    expect(JSON.stringify(githubConnections)).not.toContain(secret);
  });

  it('refuses unsigned, wrongly signed, unknown and non-JSON deliveries', async () => {
    expect((await deliver(pullRequest('opened'), { secret: 'wrong' })).status).toBe(401);
    expect((await deliver(pullRequest('opened'), { path: `/api/integrations/github/webhook/${randomUUID()}` })).status).toBe(401);
    const unsigned = await fetch(`${inject('apiUrl')}${connection.webhookPath}`, { method: 'POST', headers: { 'content-type': 'application/json', 'x-github-event': 'ping' }, body: '{}' });
    expect(unsigned.status).toBe(401);
    const form = await fetch(`${inject('apiUrl')}${connection.webhookPath}`, { method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' }, body: 'payload=x' });
    expect(form.status).toBe(415);
  });

  it('answers pings and links an opened pull request, moving the task to review', async () => {
    expect((await deliver({ zen: 'hi' }, { event: 'ping' })).status).toBe(202);
    const response = await deliver(pullRequest('opened'));
    expect(await response.json()).toEqual({ result: 'ok' });
    expect((await ws.owner.data<{ task: { status: { category: string } } }>(TASK, vars({ t: task.id }))).task.status.category).toBe('review');
    const { taskPullRequests } = await member.data<{ taskPullRequests: { number: number; state: string }[] }>(LINKS, vars({ t: task.id }));
    expect(taskPullRequests).toEqual([expect.objectContaining({ number: 17, state: 'open' })]);
  });

  it('handles a delivery once, even when GitHub sends it again', async () => {
    const delivery = randomUUID();
    expect(await (await deliver(pullRequest('edited', { title: `TF-${task.number}: renamed` }), { delivery })).json()).toEqual({ result: 'ok' });
    expect(await (await deliver(pullRequest('edited', { title: `TF-${task.number}: renamed` }), { delivery })).json()).toEqual({ result: 'duplicate' });
  });

  it('marks the task done when the pull request merges, and fires GitHub automations', async () => {
    await ws.owner.data(
      'mutation($w: ID!, $s: ID!, $input: SaveAutomationInput!) { createAutomation(workspaceId: $w, spaceId: $s, input: $input) { id } }',
      vars({ s: ws.spaceId, input: { name: 'Shipped', trigger: { type: 'github_pull_request_merged' }, actions: [{ type: 'notify', userIds: [member.id], message: '{{pr}} shipped {{task}}' }] } }),
    );
    await deliver(pullRequest('closed', { state: 'closed', merged: true }));
    expect((await ws.owner.data<{ task: { status: { category: string } } }>(TASK, vars({ t: task.id }))).task.status.category).toBe('done');
    const { taskPullRequests } = await ws.owner.data<{ taskPullRequests: { state: string }[] }>(LINKS, vars({ t: task.id }));
    expect(taskPullRequests[0]?.state).toBe('merged');
    const { notifications } = await member.data<{ notifications: { items: { kind: string; subject: string }[] } }>('query($w: ID!) { notifications(workspaceId: $w) { items { kind subject } } }', vars());
    expect(notifications.items.find((item) => item.kind === 'automation')?.subject).toMatch(/fix the crash \(#17\) shipped #\d+ Crash on save/);
  });

  it('ignores pull requests from other repositories and other events', async () => {
    expect(await (await deliver({ ...pullRequest('opened'), repository: { full_name: 'evil/repo' } })).json()).toEqual({ result: 'ignored' });
    expect(await (await deliver({ action: 'created' }, { event: 'issues' })).json()).toEqual({ result: 'ignored' });
  });

  it('stops accepting the old secret once it is replaced', async () => {
    const { rotateGithubSecret } = await ws.owner.data<{ rotateGithubSecret: { webhookSecret: string } }>(
      'mutation($w: ID!, $c: ID!) { rotateGithubSecret(workspaceId: $w, connectionId: $c) { webhookSecret } }',
      vars({ c: connection.id }),
    );
    expect((await deliver({ zen: 'x' }, { event: 'ping' })).status).toBe(401);
    secret = rotateGithubSecret.webhookSecret;
    expect((await deliver({ zen: 'x' }, { event: 'ping' })).status).toBe(202);
  });
});
