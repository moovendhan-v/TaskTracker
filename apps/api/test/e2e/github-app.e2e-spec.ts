import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, inject, it } from 'vitest';
import { TestUser } from './support/api-client.js';
import { FakeGithub } from './support/fake-github.js';
import { addMember, createWorkspace, type WorkspaceFixture } from './support/fixtures.js';
import { FAKE_GITHUB_URL } from './support/test-env.js';

const INSTALL_URL = 'mutation($w: ID!) { githubAppInstallUrl(workspaceId: $w) }';
const INFO = 'query($w: ID!) { githubApp(workspaceId: $w) { enabled canInstall slug } }';
const INSTALLATIONS = 'query($w: ID!) { githubInstallations(workspaceId: $w) { id accountLogin accountType } }';
const REPOS = 'query($w: ID!, $i: ID!) { githubInstallationRepositories(workspaceId: $w, installationId: $i) }';
const CONNECT = 'mutation($w: ID!, $input: ConnectGithubRepositoryInput!) { connectGithubRepository(workspaceId: $w, input: $input) { id repo viaApp webhookPath } }';
const LOG = 'query($w: ID!, $c: ID!) { githubSyncLog(workspaceId: $w, connectionId: $c) { detail outcome } }';
const TASK = 'query($w: ID!, $t: ID!) { task(workspaceId: $w, taskId: $t) { title status { name } } }';
const LINKS = 'query($w: ID!, $t: ID!) { taskPullRequests(workspaceId: $w, taskId: $t) { number state } }';
const CREATE_TASK = 'mutation($w: ID!, $l: ID!, $t: String!) { createTask(workspaceId: $w, listId: $l, input: { title: $t }) { id number } }';
const UPDATE_TASK = 'mutation($w: ID!, $t: ID!, $input: UpdateTaskInput!) { updateTask(workspaceId: $w, taskId: $t, input: $input) { id } }';
const CREATE_ISSUE = 'mutation($w: ID!, $t: ID!, $c: ID!) { createGithubIssue(workspaceId: $w, taskId: $t, connectionId: $c) { number url closed pending repo } }';
const ISSUES = 'query($w: ID!, $t: ID!) { taskGithubIssues(workspaceId: $w, taskId: $t) { number closed pending lastError } }';

async function eventually<T>(read: () => Promise<T>, accept: (value: T) => boolean, timeoutMs = 15_000): Promise<T> {
  const end = Date.now() + timeoutMs;
  for (;;) {
    const value = await read();
    if (accept(value)) return value;
    if (Date.now() > end) throw new Error(`Timed out; last value: ${JSON.stringify(value)}`);
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
}

/** E2: two-way sync through the TaskFlow GitHub App, against a fake GitHub. */
describe('GitHub App sync', () => {
  const github = new FakeGithub(String(inject('apiEnv')['GITHUB_APP_PRIVATE_KEY']));
  let ws: WorkspaceFixture;
  let member: TestUser;
  let guest: TestUser;
  let installationId: string;
  let connectionId: string;
  const w = () => ws.workspaceId;
  const newTask = async (title: string) => (await ws.owner.data<{ createTask: { id: string; number: number } }>(CREATE_TASK, { w: w(), l: ws.listId, t: title })).createTask;
  const task = async (t: string) => (await ws.owner.data<{ task: { title: string; status: { name: string } } }>(TASK, { w: w(), t })).task;
  const callback = async (user: TestUser, params: Record<string, string>) =>
    (await user.visit(`${inject('apiUrl')}/api/integrations/github/app-callback?${new URLSearchParams(params)}`)).headers.get('location');

  beforeAll(async () => {
    github.addInstallation(100, 'acme', ['acme/app']);
    github.addInstallation(200, 'other-co', ['other/secret']);
    await github.start();
    ws = await createWorkspace('App owner');
    member = await TestUser.signUp('App member');
    await addMember(ws, member, 'Member');
    guest = await TestUser.signUp('App guest');
    await addMember(ws, guest, 'Guest');
  });

  afterAll(async () => {
    // Stop polling the fake GitHub for the rest of the suite.
    if (installationId) await ws.owner.data('mutation($w: ID!, $i: ID!) { removeGithubInstallation(workspaceId: $w, installationId: $i) }', { w: w(), i: installationId });
    await github.stop();
  });

  it('installs only for someone GitHub lists as able to reach the installation', async () => {
    expect((await ws.owner.data<{ githubApp: unknown }>(INFO, { w: w() })).githubApp).toEqual({ enabled: true, canInstall: true, slug: 'taskflow-e2e' });
    expect((await member.error(INSTALL_URL, { w: w() })).code).toBe('FORBIDDEN');
    const url = new URL((await ws.owner.data<{ githubAppInstallUrl: string }>(INSTALL_URL, { w: w() })).githubAppInstallUrl);
    expect(`${url.origin}${url.pathname}`).toBe(`${FAKE_GITHUB_URL}/apps/taskflow-e2e/installations/new`);
    const state = url.searchParams.get('state')!;

    // Signed out: sign in first.
    expect(await callback(new TestUser('Nobody', `nobody-${randomUUID()}@example.com`), { state, code: github.codeFor([100]), installation_id: '100' })).toBe('/sign-in');
    // Someone else's install link.
    expect(await callback(member, { state, code: github.codeFor([100]), installation_id: '100' })).toBe('/?github=not-yours');
    // An installation this person can't reach on GitHub (someone else's organization).
    expect(await callback(ws.owner, { state, code: github.codeFor([100]), installation_id: '200' })).toBe(`/w/${w()}/settings?github=not-yours`);
    // A forged or tampered state.
    expect(await callback(ws.owner, { state: `${state.split('.')[0]}.forged`, code: github.codeFor([100]), installation_id: '100' })).toBe('/?github=not-yours');
    // A code GitHub doesn't know.
    expect(await callback(ws.owner, { state, code: 'unknown-code', installation_id: '100' })).toBe(`/w/${w()}/settings?github=failed`);
    expect((await ws.owner.data<{ githubInstallations: unknown[] }>(INSTALLATIONS, { w: w() })).githubInstallations).toEqual([]);

    expect(await callback(ws.owner, { state, code: github.codeFor([100]), installation_id: '100' })).toBe(`/w/${w()}/settings?github=installed`);
    const [installation] = (await ws.owner.data<{ githubInstallations: { id: string; accountLogin: string; accountType: string }[] }>(INSTALLATIONS, { w: w() })).githubInstallations;
    expect(installation).toMatchObject({ accountLogin: 'acme', accountType: 'Organization' });
    installationId = installation!.id;
  });

  it("connects only repositories the installation reaches, and they have no webhook of their own", async () => {
    expect((await ws.owner.data<{ githubInstallationRepositories: string[] }>(REPOS, { w: w(), i: installationId })).githubInstallationRepositories).toEqual(['acme/app']);
    expect((await ws.owner.error(CONNECT, { w: w(), input: { installationId, repo: 'other/secret' } })).message).toMatch(/can’t reach that repository/);
    expect((await member.error(REPOS, { w: w(), i: installationId })).code).toBe('FORBIDDEN');

    const { connectGithubRepository } = await ws.owner.data<{ connectGithubRepository: { id: string; repo: string; viaApp: boolean; webhookPath: string } }>(CONNECT, {
      w: w(),
      input: { installationId, repo: 'ACME/app' },
    });
    expect(connectGithubRepository).toMatchObject({ repo: 'acme/app', viaApp: true });
    connectionId = connectGithubRepository.id;
    const refused = await fetch(`${inject('apiUrl')}${connectGithubRepository.webhookPath}`, { method: 'POST', headers: { 'content-type': 'application/json', 'x-github-event': 'ping', 'x-hub-signature-256': 'sha256=00' }, body: '{}' });
    expect(refused.status).toBe(401);
  });

  it('reads pull requests by polling: the first look links without moving, later changes move tasks', async () => {
    const old = await newTask('Old work');
    const fresh = await newTask('Fresh work');
    const log = async () => (await ws.owner.data<{ githubSyncLog: { detail: string }[] }>(LOG, { w: w(), c: connectionId })).githubSyncLog.map((entry) => entry.detail);
    // Already open before the repository was connected: linked on the first look, not moved.
    github.pull('acme/app', { number: 5, title: `TF-${old.number}: old work` });
    await eventually(log, (details) => details.some((detail) => detail.includes('connected through the GitHub App')));
    expect((await ws.owner.data<{ taskPullRequests: { number: number }[] }>(LINKS, { w: w(), t: old.id })).taskPullRequests.map((link) => link.number)).toEqual([5]);
    expect((await task(old.id)).status.name).toBe('To do');

    github.pull('acme/app', { number: 6, title: `TF-${fresh.number}: fresh work` });
    await eventually(() => task(fresh.id), (value) => value.status.name === 'In review');
    github.pull('acme/app', { number: 6, state: 'closed', merged: true });
    await eventually(() => task(fresh.id), (value) => value.status.name === 'Done');
  });

  it('keeps an issue and its task in step both ways, without echoes', async () => {
    const t = await newTask('Login is slow');
    const { createGithubIssue } = await ws.owner.data<{ createGithubIssue: { number: number; url: string; closed: boolean; repo: string } }>(CREATE_ISSUE, { w: w(), t: t.id, c: connectionId });
    expect(createGithubIssue).toMatchObject({ repo: 'acme/app', closed: false });
    expect(createGithubIssue.url).toBe(`https://github.com/acme/app/issues/${createGithubIssue.number}`);
    const number = createGithubIssue.number;
    expect(github.issue('acme/app', number)).toMatchObject({ title: 'Login is slow', state: 'open', body: `Tracked in TaskFlow as TF-${t.number}.` });
    expect((await ws.owner.error(CREATE_ISSUE, { w: w(), t: t.id, c: connectionId })).message).toMatch(/already has an issue/);

    // TaskFlow → GitHub, straight away (no poll needed).
    await ws.owner.data(UPDATE_TASK, { w: w(), t: t.id, input: { title: 'Login is slow on mobile' } });
    await eventually(async () => github.issue('acme/app', number)!.title, (title) => title === 'Login is slow on mobile', 5_000);
    await ws.owner.data(UPDATE_TASK, { w: w(), t: t.id, input: { statusId: ws.statuses['Done'] } });
    await eventually(async () => github.issue('acme/app', number)!.state, (state) => state === 'closed', 5_000);
    const issues = async () => (await ws.owner.data<{ taskGithubIssues: { closed: boolean; pending: boolean; lastError: string | null }[] }>(ISSUES, { w: w(), t: t.id })).taskGithubIssues;
    await eventually(issues, (list) => list[0]?.closed === true && !list[0].pending);

    // GitHub → TaskFlow: reopened and renamed there, by the next poll.
    const sent = github.patches.length;
    github.editIssue('acme/app', number, { state: 'open', title: 'Login is slow on mobile Safari' });
    await eventually(() => task(t.id), (value) => value.title === 'Login is slow on mobile Safari' && value.status.name === 'To do');
    // Applying GitHub's change doesn't send it back.
    await new Promise((resolve) => setTimeout(resolve, 2_500));
    expect(github.patches.length).toBe(sent);
    expect((await issues())[0]).toMatchObject({ closed: false, pending: false, lastError: null });
  });

  it("lets only people who can edit the task open an issue, and only in the app's repositories", async () => {
    const t = await newTask('Owner only');
    expect((await guest.error(CREATE_ISSUE, { w: w(), t: t.id, c: connectionId })).code).toBe('FORBIDDEN');
    expect((await ws.owner.error(CREATE_ISSUE, { w: w(), t: t.id, c: randomUUID() })).code).toBe('NOT_FOUND');
  });
});
