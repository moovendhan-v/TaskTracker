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

  it("doesn't let someone kept out of a space reach it through a connection", async () => {
    const admin = await TestUser.signUp('GitHub admin');
    await addMember(ws, admin, 'Admin');
    const { createSpace } = await ws.owner.data<{ createSpace: { id: string } }>('mutation($w: ID!) { createSpace(workspaceId: $w, input: { name: "People ops" }) { id } }', vars());
    const { createList } = await ws.owner.data<{ createList: { id: string } }>('mutation($w: ID!, $s: ID!) { createList(workspaceId: $w, spaceId: $s, input: { name: "Hiring" }) { id } }', vars({ s: createSpace.id }));
    const { createTask: hidden } = await ws.owner.data<{ createTask: { id: string; number: number } }>(
      'mutation($w: ID!, $l: ID!) { createTask(workspaceId: $w, listId: $l, input: { title: "Salary review" }) { id number } }',
      vars({ l: createList.id }),
    );
    const { createPolicy } = await ws.owner.data<{ createPolicy: { id: string } }>(
      'mutation($w: ID!, $input: SavePolicyInput!) { createPolicy(workspaceId: $w, input: $input) { id } }',
      vars({ input: { name: 'No People ops', document: { statements: [{ effect: 'deny', permissions: ['*'], spaces: [createSpace.id] }] } } }),
    );
    await ws.owner.data('mutation($w: ID!, $r: ID!, $p: String!) { attachRolePolicy(workspaceId: $w, roleId: $r, policy: $p) { id } }', vars({ r: ws.roles.Admin, p: createPolicy.id }));

    // Rotating hands the secret over, so the connection now acts as the admin.
    const { rotateGithubSecret } = await admin.data<{ rotateGithubSecret: { webhookSecret: string } }>(
      'mutation($w: ID!, $c: ID!) { rotateGithubSecret(workspaceId: $w, connectionId: $c) { webhookSecret } }',
      vars({ c: connection.id }),
    );
    secret = rotateGithubSecret.webhookSecret;
    const pr = pullRequest('closed', { number: 18, title: `TF-${hidden.number}: peek`, state: 'closed', merged: true });
    expect(await (await deliver(pr)).json()).toEqual({ result: 'ok' });
    const { task: after } = await ws.owner.data<{ task: { status: { category: string } } }>(TASK, vars({ t: hidden.id }));
    expect(after.status.category).not.toBe('done');
    expect((await ws.owner.data<{ taskPullRequests: unknown[] }>(LINKS, vars({ t: hidden.id }))).taskPullRequests).toEqual([]);
  });

  it('logs every delivery, and keeps pull requests that mention no task in an inbox to link or dismiss', async () => {
    const LOG = 'query($w: ID!, $c: ID!) { githubSyncLog(workspaceId: $w, connectionId: $c) { event outcome detail prNumber taskNumbers } }';
    const INBOX = 'query($w: ID!) { githubPullRequestInbox(workspaceId: $w) { id number title url state } }';
    const LINK = 'mutation($w: ID!, $i: ID!, $n: Int!) { linkInboxPullRequest(workspaceId: $w, itemId: $i, taskNumber: $n) { number } }';
    const DISMISS = 'mutation($w: ID!, $i: ID!) { dismissInboxPullRequest(workspaceId: $w, itemId: $i) }';

    const log = (await ws.owner.data<{ githubSyncLog: { event: string; outcome: string; detail: string; prNumber: number | null; taskNumbers: number[] }[] }>(LOG, vars({ c: connection.id }))).githubSyncLog;
    expect(log.some((entry) => entry.outcome === 'error' && entry.detail === 'bad signature')).toBe(true);
    expect(log.some((entry) => entry.outcome === 'ok' && entry.event === 'pull_request' && entry.taskNumbers.includes(task.number))).toBe(true);
    expect((await member.error(LOG, vars({ c: connection.id }))).code).toBe('FORBIDDEN');

    // Two pull requests that mention no task land in the inbox.
    for (const number of [30, 31]) expect(await (await deliver(pullRequest('opened', { number, title: 'Tidy the README', html_url: `https://github.com/acme/web/pull/${number}` }))).json()).toEqual({ result: 'ok' });
    const inbox = (await ws.owner.data<{ githubPullRequestInbox: { id: string; number: number; title: string; url: string; state: string }[] }>(INBOX, vars())).githubPullRequestInbox;
    const thirty = inbox.find((item) => item.number === 30)!;
    const thirtyOne = inbox.find((item) => item.number === 31)!;
    expect(thirty).toMatchObject({ title: 'Tidy the README', url: 'https://github.com/acme/web/pull/30', state: 'open' });
    expect((await ws.owner.data<{ githubSyncLog: { detail: string }[] }>(LOG, vars({ c: connection.id }))).githubSyncLog[0]!.detail).toMatch(/0 linked \(in the pull request inbox\)/);
    expect((await member.error(INBOX, vars())).code).toBe('FORBIDDEN');

    // Link one to a task by number; dismiss the other.
    expect((await ws.owner.error(LINK, vars({ i: thirty.id, n: 999_999 }))).message).toMatch(/no task #999999/);
    await ws.owner.data(LINK, vars({ i: thirty.id, n: task.number }));
    expect((await ws.owner.data<{ taskPullRequests: { number: number }[] }>(LINKS, vars({ t: task.id }))).taskPullRequests.map((link) => link.number)).toContain(30);
    expect((await ws.owner.data<{ dismissInboxPullRequest: boolean }>(DISMISS, vars({ i: thirtyOne.id }))).dismissInboxPullRequest).toBe(true);
    const left = (await ws.owner.data<{ githubPullRequestInbox: { number: number }[] }>(INBOX, vars())).githubPullRequestInbox.map((item) => item.number);
    expect(left).not.toContain(30);
    expect(left).not.toContain(31);
  });
});
