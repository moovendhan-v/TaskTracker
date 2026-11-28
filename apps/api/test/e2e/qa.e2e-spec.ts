import { beforeAll, describe, expect, it } from 'vitest';
import { TestUser } from './support/api-client.js';
import { addMember, createWorkspace, type WorkspaceFixture } from './support/fixtures.js';

const SUITE = 'mutation($w: ID!, $s: ID!, $id: ID, $n: String!) { saveQaSuite(workspaceId: $w, spaceId: $s, suiteId: $id, name: $n) { id name caseCount } }';
const CASE = 'mutation($w: ID!, $s: ID!, $id: ID, $input: SaveQaCaseInput!) { saveQaCase(workspaceId: $w, spaceId: $s, caseId: $id, input: $input) { id number title steps { action expected } priority status suiteId coversTaskId coversTaskTitle lastResult } }';
const CASES = 'query($w: ID!, $s: ID!, $suite: ID, $q: String) { qaCases(workspaceId: $w, spaceId: $s, suiteId: $suite, search: $q) { id number title lastResult } }';
const PLAN = 'mutation($w: ID!, $s: ID!, $input: SaveQaPlanInput!) { saveQaPlan(workspaceId: $w, spaceId: $s, input: $input) { id name release status counts { total notRun } } }';
const ADD = 'mutation($w: ID!, $p: ID!, $input: AddQaPlanCasesInput!) { addQaPlanCases(workspaceId: $w, planId: $p, input: $input) }';
const PLAN_CASES = 'query($w: ID!, $p: ID!) { qaPlanCases(workspaceId: $w, planId: $p) { caseId number result runs bugTaskId bugNumber bugQaState executedByName } }';
const RUN = 'mutation($w: ID!, $input: RecordQaRunInput!) { recordQaRun(workspaceId: $w, input: $input) { caseId result bugTaskId bugNumber bugQaState runs } }';
const DECIDE = 'mutation($w: ID!, $p: ID!, $d: String!, $n: String) { decideQaPlan(workspaceId: $w, planId: $p, decision: $d, note: $n) { status decidedByName decisionNote counts { total passed failed blocked skipped notRun } } }';
const READY = 'query($w: ID!, $p: ID!) { qaReadiness(workspaceId: $w, planId: $p) { ready checks { key ok detail } openBugs { number severity qaState } } }';
const COVERAGE = 'query($w: ID!, $s: ID!) { qaCoverage(workspaceId: $w, spaceId: $s) { features coveredFeatures uncovered { title } cases readyCases neverRun flaky { number } } }';
const HISTORY = 'query($w: ID!, $c: ID!) { qaCaseRuns(workspaceId: $w, caseId: $c) { result planName bugNumber retestOf executedByName stepResults { result actual } } }';
const SET_QA = 'mutation($w: ID!, $t: ID!, $s: String!) { setBugQaState(workspaceId: $w, taskId: $t, state: $s) { qaState } }';

type Case = { id: string; number: number; title: string; coversTaskTitle: string | null };
type PlanCase = { caseId: string; result: string | null; runs: number; bugTaskId: string | null; bugNumber: number | null; bugQaState: string | null };

describe('QA test management (E6.4)', () => {
  let ws: WorkspaceFixture;
  let w: string;
  let s: string;
  let tester: TestUser;
  let login: Case;
  let checkout: Case;
  let search: Case;
  let planId: string;

  beforeAll(async () => {
    ws = await createWorkspace('QA owner');
    w = ws.workspaceId;
    s = ws.spaceId;
    tester = await TestUser.signUp('QA tester');
    await addMember(ws, tester, 'Member');
  });

  it('organises test cases in suites, numbered per project, covering features', async () => {
    const suite = (await tester.data<{ saveQaSuite: { id: string } }>(SUITE, { w, s, id: null, n: 'Checkout' })).saveQaSuite;
    expect((await tester.error(SUITE, { w, s, id: null, n: 'Checkout' })).message).toMatch(/already exists/);
    const feature = (await tester.data<{ createTask: { id: string } }>('mutation($w: ID!, $l: ID!) { createTask(workspaceId: $w, listId: $l, input: { title: "Pay by card", type: feature }) { id } }', { w, l: ws.listId })).createTask.id;
    await tester.data('mutation($w: ID!, $l: ID!) { createTask(workspaceId: $w, listId: $l, input: { title: "Gift cards", type: feature }) { id } }', { w, l: ws.listId });

    login = (await tester.data<{ saveQaCase: Case }>(CASE, { w, s, id: null, input: { title: 'Sign in with email', steps: [{ action: 'Open /login', expected: 'The form shows' }, { action: 'Sign in', expected: 'The dashboard opens' }], priority: 'high' } })).saveQaCase;
    checkout = (await tester.data<{ saveQaCase: Case }>(CASE, {
      w,
      s,
      id: null,
      input: { title: 'Pay with a card', suiteId: suite.id, coversTaskId: feature, priority: 'critical', type: 'smoke', preconditions: 'A cart with one item', steps: [{ action: 'Press Pay', expected: 'Payment succeeds' }, { action: '  ', expected: '' }] },
    })).saveQaCase;
    search = (await tester.data<{ saveQaCase: Case }>(CASE, { w, s, id: null, input: { title: 'Search finds products', steps: [{ action: 'Search for "mug"', expected: 'Mugs are listed' }], priority: 'low' } })).saveQaCase;
    await tester.data(CASE, { w, s, id: null, input: { title: 'Old flow', steps: [], status: 'deprecated' } });
    expect([login.number, checkout.number, search.number]).toEqual([1, 2, 3]);
    expect(checkout).toMatchObject({ coversTaskTitle: 'Pay by card', steps: [{ action: 'Press Pay', expected: 'Payment succeeds' }], priority: 'critical' });

    expect((await tester.data<{ qaCases: Case[] }>(CASES, { w, s, suite: suite.id, q: null })).qaCases.map((item) => item.title)).toEqual(['Pay with a card']);
    expect((await tester.data<{ qaCases: Case[] }>(CASES, { w, s, suite: null, q: 'C-3' })).qaCases.map((item) => item.title)).toEqual(['Search finds products']);
    expect((await tester.error(CASE, { w, s, id: null, input: { title: '', steps: [] } })).message).toMatch(/title/);

    const coverage = (await tester.data<{ qaCoverage: { features: number; coveredFeatures: number; uncovered: { title: string }[]; readyCases: number; neverRun: number } }>(COVERAGE, { w, s })).qaCoverage;
    expect(coverage).toMatchObject({ features: 2, coveredFeatures: 1, uncovered: [{ title: 'Gift cards' }], readyCases: 3, neverRun: 3 });
  });

  it('plans a release with every ready case and runs it; a failure files a bug', async () => {
    const plan = (await tester.data<{ saveQaPlan: { id: string; status: string } }>(PLAN, { w, s, input: { name: 'Release 2.4 regression', release: '2.4' } })).saveQaPlan;
    planId = plan.id;
    expect((await tester.data<{ addQaPlanCases: number }>(ADD, { w, p: planId, input: { allReady: true } })).addQaPlanCases).toBe(3);
    expect((await tester.data<{ addQaPlanCases: number }>(ADD, { w, p: planId, input: { caseIds: [login.id] } })).addQaPlanCases).toBe(0);

    await tester.data(RUN, { w, input: { planId, caseId: login.id, result: 'passed', stepResults: [{ result: 'passed', actual: '' }, { result: 'passed', actual: '' }] } });
    const failed = (await tester.data<{ recordQaRun: PlanCase }>(RUN, {
      w,
      input: { planId, caseId: checkout.id, result: 'failed', stepResults: [{ result: 'failed', actual: 'Card declined for a valid card' }], actual: 'Error toast', environment: 'staging', build: '2.4.0-rc1' },
    })).recordQaRun;
    expect(failed).toMatchObject({ result: 'failed', bugQaState: 'new' });
    expect(failed.bugTaskId).toBeTruthy();

    const { bug } = await tester.data<{ bug: { title: string; source: string; severity: string; environment: string; actual: string; steps: { text: string }[] } }>(
      'query($w: ID!, $t: ID!) { bug(workspaceId: $w, taskId: $t) { title source severity environment actual steps { text } } }',
      { w, t: failed.bugTaskId },
    );
    expect(bug).toMatchObject({ title: `Test failed: C-${checkout.number} Pay with a card`, source: 'test_run', severity: 'P1', environment: 'staging' });
    expect(bug.actual).toContain('Step 1 failed: Card declined for a valid card');
    expect(bug.actual).toContain('build 2.4.0-rc1');
    expect(bug.steps.map((step) => step.text)).toContain('Press Pay');

    await tester.data(RUN, { w, input: { planId, caseId: search.id, result: 'blocked', actual: 'Search service down' } });
    expect((await tester.error(RUN, { w, input: { planId, caseId: login.id, result: 'exploded' } })).code).toBe('BAD_USER_INPUT');
  });

  it('gates release on readiness and QA approval', async () => {
    const readiness = (await tester.data<{ qaReadiness: { ready: boolean; checks: { key: string; ok: boolean }[]; openBugs: { severity: string }[] } }>(READY, { w, p: planId })).qaReadiness;
    expect(readiness.ready).toBe(false);
    expect(Object.fromEntries(readiness.checks.map((check) => [check.key, check.ok]))).toEqual({ all_run: true, no_failures: false, no_blocked: false, no_open_blockers: false, approved: false });
    expect(readiness.openBugs).toEqual([expect.objectContaining({ severity: 'P1' })]);

    // Only project admins sign off; failures need a written reason.
    expect((await tester.error(DECIDE, { w, p: planId, d: 'approved', n: null })).code).toBe('FORBIDDEN');
    expect((await ws.owner.error(DECIDE, { w, p: planId, d: 'approved', n: null })).message).toMatch(/failed or are blocked/);
    expect((await ws.owner.error(DECIDE, { w, p: planId, d: 'rejected', n: null })).message).toMatch(/why/);
    const rejected = (await ws.owner.data<{ decideQaPlan: { status: string; decisionNote: string } }>(DECIDE, { w, p: planId, d: 'rejected', n: 'Card payments broken' })).decideQaPlan;
    expect(rejected).toMatchObject({ status: 'rejected', decisionNote: 'Card payments broken' });
  });

  it('retests: a pass verifies the fix, and the history keeps every run', async () => {
    const [failing] = (await tester.data<{ qaPlanCases: PlanCase[] }>(PLAN_CASES, { w, p: planId })).qaPlanCases.filter((item) => item.caseId === checkout.id);
    // A still-failing retest reuses (reopens) the bug instead of filing another.
    await tester.data(SET_QA, { w, t: failing!.bugTaskId, s: 'confirmed' });
    await tester.data(SET_QA, { w, t: failing!.bugTaskId, s: 'fixed' });
    const stillFailing = (await tester.data<{ recordQaRun: PlanCase }>(RUN, { w, input: { planId, caseId: checkout.id, result: 'failed', actual: 'Still declined' } })).recordQaRun;
    expect(stillFailing).toMatchObject({ bugTaskId: failing!.bugTaskId, bugQaState: 'reopened' });

    await tester.data(SET_QA, { w, t: failing!.bugTaskId, s: 'fixed' });
    const passed = (await tester.data<{ recordQaRun: PlanCase }>(RUN, { w, input: { planId, caseId: checkout.id, result: 'passed' } })).recordQaRun;
    expect(passed).toMatchObject({ result: 'passed', bugTaskId: failing!.bugTaskId, bugQaState: 'verified', runs: 3 });
    await tester.data(RUN, { w, input: { planId, caseId: search.id, result: 'passed' } });

    const history = (await tester.data<{ qaCaseRuns: { result: string; retestOf: string | null; executedByName: string; planName: string }[] }>(HISTORY, { w, c: checkout.id })).qaCaseRuns;
    expect(history.map((run) => run.result)).toEqual(['passed', 'failed', 'failed']);
    expect(history[0]!.retestOf).toBeTruthy();
    expect(history[0]).toMatchObject({ executedByName: 'QA tester', planName: 'Release 2.4 regression' });

    const coverage = (await tester.data<{ qaCoverage: { neverRun: number; flaky: { number: number }[] } }>(COVERAGE, { w, s })).qaCoverage;
    expect(coverage.neverRun).toBe(0);
    expect(coverage.flaky.map((item) => item.number)).toEqual([checkout.number]);
  });

  it('approves when everything passed; an approved plan is frozen until reopened', async () => {
    await ws.owner.data(DECIDE, { w, p: planId, d: 'open', n: null });
    const approved = (await ws.owner.data<{ decideQaPlan: { status: string; decidedByName: string; counts: { passed: number; total: number } } }>(DECIDE, { w, p: planId, d: 'approved', n: null })).decideQaPlan;
    expect(approved).toMatchObject({ status: 'approved', decidedByName: 'QA owner', counts: { passed: 3, total: 3 } });
    const readiness = (await tester.data<{ qaReadiness: { ready: boolean } }>(READY, { w, p: planId })).qaReadiness;
    expect(readiness.ready).toBe(true);

    expect((await tester.error(RUN, { w, input: { planId, caseId: login.id, result: 'failed' } })).message).toMatch(/approved/);
    expect((await tester.error(ADD, { w, p: planId, input: { allReady: true } })).message).toMatch(/approved/);
    const actions = (await ws.owner.data<{ workspaceAuditLog: { items: { action: string }[] } }>('query($w: ID!) { workspaceAuditLog(workspaceId: $w) { items { action } } }', { w })).workspaceAuditLog.items.map((item) => item.action);
    expect(actions).toEqual(expect.arrayContaining(['qa_plan.reject', 'qa_plan.reopen', 'qa_plan.approve']));
  });

  it('keeps QA inside its workspace', async () => {
    const other = await createWorkspace('QA outsider');
    expect((await other.owner.error(PLAN_CASES, { w: other.workspaceId, p: planId })).code).toBe('NOT_FOUND');
    expect((await other.owner.error('query($w: ID!, $c: ID!) { qaCase(workspaceId: $w, caseId: $c) { id } }', { w: other.workspaceId, c: login.id })).code).toBe('NOT_FOUND');
    expect((await other.owner.error(CASES, { w: other.workspaceId, s, suite: null, q: null })).code).toBe('NOT_FOUND');
    expect((await other.owner.error(RUN, { w: other.workspaceId, input: { planId, caseId: login.id, result: 'passed' } })).code).toBe('NOT_FOUND');
  });
});
