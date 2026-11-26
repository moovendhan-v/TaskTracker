import { beforeAll, describe, expect, it } from 'vitest';
import { TestUser } from './support/api-client.js';
import { addMember, createWorkspace, type WorkspaceFixture } from './support/fixtures.js';

const BUG = 'taskId number title spaceId listId statusName priority kind severity environment module expected actual steps { text source } qaState source pageUrl browser os viewport reporterId duplicateOfTaskId consoleErrors failedRequests';
const REPORT = `mutation($w: ID!, $input: ReportBugInput!) { reportBug(workspaceId: $w, input: $input) { ${BUG} } }`;
const GET = `query($w: ID!, $t: ID!) { bug(workspaceId: $w, taskId: $t) { ${BUG} } }`;
const LIST = `query($w: ID!, $s: ID!, $f: BugFilterInput) { bugs(workspaceId: $w, spaceId: $s, filter: $f) { taskId title severity qaState } }`;
const CAPTURE = 'query($w: ID!, $t: ID!) { bugCapture(workspaceId: $w, taskId: $t) }';
const UPDATE = `mutation($w: ID!, $t: ID!, $input: UpdateBugInput!) { updateBug(workspaceId: $w, taskId: $t, input: $input) { ${BUG} } }`;
const QA = 'mutation($w: ID!, $t: ID!, $s: String!) { setBugQaState(workspaceId: $w, taskId: $t, state: $s) { qaState } }';
const SIMILAR = 'query($w: ID!, $s: ID!, $title: String!, $x: ID) { similarBugs(workspaceId: $w, spaceId: $s, title: $title, excludeTaskId: $x) { taskId title score } }';
const DUPLICATE = 'mutation($w: ID!, $t: ID!, $o: ID!) { markBugDuplicate(workspaceId: $w, taskId: $t, ofTaskId: $o) { qaState duplicateOfTaskId } }';
const ACTIVITY = 'query($w: ID!, $t: ID!) { taskActivity(workspaceId: $w, taskId: $t) { field from to } }';

type Bug = Record<string, unknown> & { taskId: string; steps: { text: string; source: string }[] };

describe('Bug reports (E6)', () => {
  let ws: WorkspaceFixture;
  let w: string;
  let member: TestUser;
  let login: Bug;

  beforeAll(async () => {
    ws = await createWorkspace('Bugs owner');
    w = ws.workspaceId;
    member = await TestUser.signUp('Bugs member');
    await addMember(ws, member, 'Member');
  });

  it('files a report as a bug task, with diagnostics redacted on the server', async () => {
    const capture = {
      console: [
        { level: 'error', message: 'Uncaught TypeError: session token=sk_live_abcdef1234567890 is undefined', at: 900 },
        { level: 'log', message: 'booted', at: 10 },
      ],
      network: [
        { method: 'POST', url: 'https://app.example.com/api/login?access_token=leaky', status: 500, durationMs: 120, at: 800, requestHeaders: { Cookie: 'sid=abc', Accept: 'application/json' }, requestBody: '{"email":"a@b.co","password":"hunter2"}' },
        { method: 'GET', url: 'https://app.example.com/api/me', status: 200, durationMs: 20, at: 100 },
      ],
      actions: [
        { type: 'navigate', at: 0, target: 'https://app.example.com/login' },
        { type: 'input', at: 300, target: 'Password', value: 'hunter2' },
        { type: 'click', at: 700, target: 'Sign in' },
      ],
    };
    login = (
      await member.data<{ reportBug: Bug }>(REPORT, {
        w,
        input: {
          spaceId: ws.spaceId,
          title: 'Sign in fails with a 500',
          severity: 'P1',
          environment: 'staging',
          module: 'Auth',
          expected: 'I land on the dashboard',
          actual: 'An error toast, and I stay on the sign-in page',
          steps: ['Open the sign-in page'],
          context: { pageUrl: 'https://app.example.com/login?token=abc123', browser: 'Chrome 132', os: 'macOS 15', viewport: '1440x900' },
          captureJson: JSON.stringify(capture),
        },
      })
    ).reportBug;

    expect(login).toMatchObject({ kind: 'bug', severity: 'P1', environment: 'staging', module: 'Auth', qaState: 'new', source: 'app', priority: 'urgent', browser: 'Chrome 132', viewport: '1440x900', consoleErrors: 1, failedRequests: 1, listId: ws.listId });
    expect(login['pageUrl']).not.toContain('abc123');
    // Manual steps first, then the ones read from the captured actions (never with typed values).
    expect(login.steps[0]).toEqual({ text: 'Open the sign-in page', source: 'manual' });
    expect(login.steps.filter((step) => step.source === 'captured').length).toBeGreaterThanOrEqual(2);
    expect(JSON.stringify(login.steps)).not.toContain('hunter2');
    expect(login.steps).toContainEqual({ text: 'Fill in “Password”', source: 'captured' });

    const stored = (await member.data<{ bugCapture: string }>(CAPTURE, { w, t: login.taskId })).bugCapture;
    for (const secret of ['sk_live_abcdef1234567890', 'leaky', 'sid=abc', 'hunter2']) expect(stored).not.toContain(secret);
    const parsed = JSON.parse(stored) as { console: unknown[]; network: { status: number }[]; actions: unknown[] };
    expect(parsed.console).toHaveLength(2);
    expect(parsed.network.map((entry) => entry.status)).toEqual([500, 200]);

    // It is an ordinary task too: type bug, expected / actual in the description.
    const { task } = await member.data<{ task: { type: string; description: string } }>('query($w: ID!, $t: ID!) { task(workspaceId: $w, taskId: $t) { type description } }', { w, t: login.taskId });
    expect(task.type).toBe('bug');
    expect(task.description).toContain('I land on the dashboard');
  });

  it('refuses a capture that is not the expected JSON', async () => {
    expect((await member.error(REPORT, { w, input: { spaceId: ws.spaceId, title: 'Bad capture', captureJson: '{nope' } })).message).toMatch(/capture/i);
    expect((await member.error(REPORT, { w, input: { spaceId: ws.spaceId, title: 'Bad severity', severity: 'P9' } })).code).toBe('BAD_USER_INPUT');
  });

  it('lists and filters reports, most severe first', async () => {
    await member.data(REPORT, { w, input: { spaceId: ws.spaceId, title: 'Add dark mode to the export', kind: 'feature_request', severity: 'P4' } });
    await member.data(REPORT, { w, input: { spaceId: ws.spaceId, title: 'Typo on the pricing page', severity: 'P3', environment: 'production' } });
    const all = (await member.data<{ bugs: { title: string; severity: string }[] }>(LIST, { w, s: ws.spaceId, f: null })).bugs;
    expect(all.map((bug) => bug.severity)).toEqual(['P1', 'P3', 'P4']);
    const features = (await member.data<{ bugs: { title: string }[] }>(LIST, { w, s: ws.spaceId, f: { kinds: ['feature_request'] } })).bugs;
    expect(features.map((bug) => bug.title)).toEqual(['Add dark mode to the export']);
    expect((await member.data<{ bugs: unknown[] }>(LIST, { w, s: ws.spaceId, f: { environments: ['production'], search: 'pricing' } })).bugs).toHaveLength(1);
    // Wildcards are literal text.
    expect((await member.data<{ bugs: unknown[] }>(LIST, { w, s: ws.spaceId, f: { search: '%' } })).bugs).toHaveLength(0);
  });

  it('edits the report and records the changes in task activity', async () => {
    const updated = (await member.data<{ updateBug: Bug }>(UPDATE, { w, t: login.taskId, input: { severity: 'P0', environment: 'production', steps: [{ text: 'Open /login', source: 'manual' }] } })).updateBug;
    expect(updated).toMatchObject({ severity: 'P0', environment: 'production', steps: [{ text: 'Open /login', source: 'manual' }] });
    const activity = (await member.data<{ taskActivity: { field: string | null; from: string | null; to: string | null }[] }>(ACTIVITY, { w, t: login.taskId })).taskActivity;
    expect(activity).toEqual(expect.arrayContaining([expect.objectContaining({ field: 'severity', from: 'P1', to: 'P0' }), expect.objectContaining({ field: 'steps' })]));
  });

  it('moves through QA: confirm, fix, retest, reopen, verify; refuses skipped steps', async () => {
    const move = async (state: string) => (await member.data<{ setBugQaState: { qaState: string } }>(QA, { w, t: login.taskId, s: state })).setBugQaState.qaState;
    expect((await member.error(QA, { w, t: login.taskId, s: 'verified' })).message).toMatch(/can't move/);
    expect((await member.error(QA, { w, t: login.taskId, s: 'nonsense' })).message).toMatch(/Unknown QA state/);
    expect(await move('confirmed')).toBe('confirmed');
    expect(await move('fixed')).toBe('fixed');
    expect(await move('retest')).toBe('retest');
    expect(await move('reopened')).toBe('reopened');
    expect(await move('fixed')).toBe('fixed');
    expect(await move('retest')).toBe('retest');
    expect(await move('verified')).toBe('verified');
    const activity = (await member.data<{ taskActivity: { field: string | null; to: string | null }[] }>(ACTIVITY, { w, t: login.taskId })).taskActivity;
    expect(activity.filter((entry) => entry.field === 'QA state').map((entry) => entry.to)).toContain('reopened');
  });

  it('finds similar reports and links a duplicate', async () => {
    const again = (await member.data<{ reportBug: Bug }>(REPORT, { w, input: { spaceId: ws.spaceId, title: 'Sign in fails with error 500' } })).reportBug;
    const similar = (await member.data<{ similarBugs: { taskId: string; score: number }[] }>(SIMILAR, { w, s: ws.spaceId, title: 'Sign in fails with error 500', x: again.taskId })).similarBugs;
    expect(similar[0]).toMatchObject({ taskId: login.taskId });
    expect(similar[0]!.score).toBeGreaterThan(0.3);
    expect(similar.some((bug) => bug.taskId === again.taskId)).toBe(false);

    const marked = (await member.data<{ markBugDuplicate: { qaState: string; duplicateOfTaskId: string } }>(DUPLICATE, { w, t: again.taskId, o: login.taskId })).markBugDuplicate;
    expect(marked).toEqual({ qaState: 'duplicate', duplicateOfTaskId: login.taskId });
    expect((await member.error(DUPLICATE, { w, t: login.taskId, o: again.taskId })).message).toMatch(/already a duplicate/);
    expect((await member.error(DUPLICATE, { w, t: login.taskId, o: login.taskId })).message).toMatch(/itself/);
    expect((await member.error(QA, { w, t: login.taskId, s: 'duplicate' })).message).toMatch(/duplicate of another/);
  });

  it('keeps reports inside their workspace', async () => {
    const other = await createWorkspace('Bugs outsider');
    expect((await other.owner.error(GET, { w: other.workspaceId, t: login.taskId })).code).toBe('NOT_FOUND');
    expect((await other.owner.error(CAPTURE, { w: other.workspaceId, t: login.taskId })).code).toBe('NOT_FOUND');
    // Lists are read within the caller's workspace, so another workspace's project id finds nothing.
    expect((await other.owner.data<{ bugs: unknown[] }>(LIST, { w: other.workspaceId, s: ws.spaceId, f: null })).bugs).toEqual([]);
    expect((await other.owner.data<{ similarBugs: unknown[] }>(SIMILAR, { w: other.workspaceId, s: ws.spaceId, title: 'Sign in fails', x: null })).similarBugs).toEqual([]);
    expect((await other.owner.error(REPORT, { w: other.workspaceId, input: { spaceId: ws.spaceId, title: 'Sneaky' } })).code).toMatch(/NOT_FOUND|FORBIDDEN/);
    expect((await other.owner.error(GET, { w, t: login.taskId })).code).toMatch(/FORBIDDEN|NOT_FOUND/);
    expect((await other.owner.data<{ bugs: unknown[] }>(LIST, { w: other.workspaceId, s: other.spaceId, f: null })).bugs).toEqual([]);
  });
});
