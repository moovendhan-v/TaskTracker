import { Injectable } from '@nestjs/common';
import {
  BUG_ENVIRONMENTS,
  QA_CASE_PRIORITIES,
  QA_CASE_STATUSES,
  QA_CASE_TYPES,
  QA_LIMITS,
  QA_PRIORITY_SEVERITY,
  QA_RESULTS,
  readinessChecks,
  type BugEnvironment,
  type QaCaseResponse,
  type QaCaseStatus,
  type QaCoverageResponse,
  type QaPlanCaseResponse,
  type QaPlanResponse,
  type QaReadinessResponse,
  type QaRunResponse,
  type QaStep,
  type QaStepResult,
  type QaSuiteResponse,
  type RecordQaRunRequest,
  type SaveQaCaseRequest,
  type SaveQaPlanRequest,
} from '@taskflow/shared-types';
import { AccessService } from '../../../core/access/access.service.js';
import { SpaceGuard } from '../../../core/access/space-guard.js';
import { AuditLogger } from '../../../core/audit/audit-logger.port.js';
import { DomainError } from '../../../core/domain/domain-error.js';
import type { Actor, WorkspaceAccess } from '../../../core/http/types/authenticated-request.js';
import { BugsService } from '../../bugs/application/bugs.service.js';
import { SpacesService } from '../../spaces/application/spaces.service.js';
import { QaRepository, type CaseFields, type PlanRow } from '../domain/qa.repository.js';

const clean = (value: string | null | undefined, max: number) => (value ?? '').replace(/\r\n/g, '\n').trim().slice(0, max);
const pick = <T extends string>(value: unknown, allowed: readonly T[], fallback: T): T => ((allowed as readonly unknown[]).includes(value) ? (value as T) : fallback);

/**
 * E6.4 QA test management. Reading follows task.view in the project; writing (cases, suites,
 * plans, results) task.update there; approving or rejecting a plan is for project admins
 * (space.manage) and is audited. A failed result files a bug (task.create) with the case's steps
 * and the run's details; a passing retest verifies that bug, a failing one reopens it.
 */
@Injectable()
export class QaService {
  constructor(
    private readonly qa: QaRepository,
    private readonly bugs: BugsService,
    private readonly spaces: SpacesService,
    private readonly accessService: AccessService,
    private readonly audit: AuditLogger,
  ) {}

  // ── Suites ────────────────────────────────────────────────────────────────
  async listSuites(access: WorkspaceAccess, spaceId: string): Promise<QaSuiteResponse[]> {
    await this.space(access, spaceId, 'task.view');
    return this.qa.listSuites(access.workspaceId, spaceId);
  }

  async saveSuite(access: WorkspaceAccess, spaceId: string, suiteId: string | null, name: string, description: string | null): Promise<QaSuiteResponse> {
    await this.space(access, spaceId, 'task.update');
    const title = clean(name, QA_LIMITS.name);
    if (!title) throw DomainError.invalid('Give the suite a name');
    try {
      if (suiteId) {
        const suite = await this.suite(access, suiteId);
        if (suite.spaceId !== spaceId) throw DomainError.notFound('Suite');
        await this.qa.updateSuite(access.workspaceId, suiteId, title, clean(description, QA_LIMITS.description));
      } else {
        suiteId = await this.qa.insertSuite(access.workspaceId, spaceId, title, clean(description, QA_LIMITS.description));
      }
    } catch (error) {
      if ((error as { code?: string }).code === '23505') throw DomainError.conflict('A suite with that name already exists');
      throw error;
    }
    return (await this.qa.listSuites(access.workspaceId, spaceId)).find((suite) => suite.id === suiteId)!;
  }

  /** Its cases stay, without a suite. */
  async deleteSuite(access: WorkspaceAccess, suiteId: string): Promise<boolean> {
    const suite = await this.suite(access, suiteId);
    SpaceGuard.assert(suite.spaceId, 'task.update');
    await this.qa.deleteSuite(access.workspaceId, suiteId);
    return true;
  }

  // ── Cases ─────────────────────────────────────────────────────────────────
  async listCases(access: WorkspaceAccess, spaceId: string, filter: { suiteId?: string | null; status?: string | null; search?: string | null }): Promise<QaCaseResponse[]> {
    await this.space(access, spaceId, 'task.view');
    const status = filter.status ? pick<QaCaseStatus>(filter.status, QA_CASE_STATUSES, 'ready') : null;
    return this.qa.listCases(access.workspaceId, spaceId, { suiteId: filter.suiteId ?? null, status, search: filter.search ?? null });
  }

  async getCase(access: WorkspaceAccess, caseId: string): Promise<QaCaseResponse> {
    const found = await this.qa.findCase(access.workspaceId, caseId);
    if (!found) throw DomainError.notFound('Test case');
    return found;
  }

  async saveCase(actor: Actor, access: WorkspaceAccess, spaceId: string, caseId: string | null, request: SaveQaCaseRequest): Promise<QaCaseResponse> {
    await this.space(access, spaceId, 'task.update');
    const fields = await this.caseFields(access, spaceId, request);
    if (caseId) {
      const existing = await this.getCase(access, caseId);
      if (existing.spaceId !== spaceId) throw DomainError.notFound('Test case');
      await this.qa.updateCase(access.workspaceId, caseId, fields);
    } else {
      caseId = await this.qa.insertCase(access.workspaceId, spaceId, actor.userId, fields);
    }
    return this.getCase(access, caseId);
  }

  async deleteCase(access: WorkspaceAccess, caseId: string): Promise<boolean> {
    const found = await this.getCase(access, caseId);
    SpaceGuard.assert(found.spaceId, 'task.update');
    await this.qa.deleteCase(access.workspaceId, caseId);
    return true;
  }

  /** Every run of a case, newest first, across plans. */
  async caseRuns(access: WorkspaceAccess, caseId: string): Promise<QaRunResponse[]> {
    await this.getCase(access, caseId);
    return this.qa.runsForCase(access.workspaceId, caseId, 100);
  }

  // ── Plans ─────────────────────────────────────────────────────────────────
  async listPlans(access: WorkspaceAccess, spaceId: string): Promise<QaPlanResponse[]> {
    await this.space(access, spaceId, 'task.view');
    const plans = await this.qa.listPlans(access.workspaceId, spaceId);
    const counts = await this.qa.counts(access.workspaceId, plans.map((plan) => plan.id));
    return plans.map((plan) => ({ ...plan, counts: counts.get(plan.id)! }));
  }

  async getPlan(access: WorkspaceAccess, planId: string): Promise<QaPlanResponse> {
    const plan = await this.plan(access, planId);
    return { ...plan, counts: (await this.qa.counts(access.workspaceId, [planId])).get(planId)! };
  }

  async savePlan(actor: Actor, access: WorkspaceAccess, spaceId: string, planId: string | null, request: SaveQaPlanRequest): Promise<QaPlanResponse> {
    await this.space(access, spaceId, 'task.update');
    const name = clean(request.name, QA_LIMITS.name);
    if (!name) throw DomainError.invalid('Give the plan a name');
    const sprintId = request.sprintId ?? null;
    if (sprintId && !(await this.qa.sprintInSpace(access.workspaceId, spaceId, sprintId))) throw DomainError.invalid('Pick a sprint of this project');
    const fields = { name, description: clean(request.description, QA_LIMITS.description), sprintId, release: clean(request.release, QA_LIMITS.release) || null };
    if (planId) {
      const plan = await this.plan(access, planId);
      if (plan.spaceId !== spaceId) throw DomainError.notFound('Test plan');
      await this.qa.updatePlan(access.workspaceId, planId, fields);
    } else {
      planId = await this.qa.insertPlan(access.workspaceId, spaceId, actor.userId, fields);
    }
    return this.getPlan(access, planId);
  }

  async deletePlan(access: WorkspaceAccess, planId: string): Promise<boolean> {
    const plan = await this.plan(access, planId);
    SpaceGuard.assert(plan.spaceId, 'task.update');
    await this.qa.deletePlan(access.workspaceId, planId);
    return true;
  }

  /** Adds cases by id, or every ready case (of one suite, or of the project). Returns how many were new. */
  async addCasesToPlan(access: WorkspaceAccess, planId: string, input: { caseIds?: string[] | null; suiteId?: string | null; allReady?: boolean | null }): Promise<number> {
    const plan = await this.editablePlan(access, planId);
    let ids: string[];
    if (input.caseIds?.length) ids = await this.qa.caseIdsInSpace(access.workspaceId, plan.spaceId, input.caseIds.slice(0, 500));
    else if (input.suiteId || input.allReady) ids = await this.qa.readyCaseIds(access.workspaceId, plan.spaceId, input.suiteId ?? null);
    else throw DomainError.invalid('Pick test cases, a suite, or all ready cases');
    if ((await this.qa.planCaseCount(access.workspaceId, planId)) + ids.length > QA_LIMITS.planCases) throw DomainError.invalid(`A plan can hold up to ${QA_LIMITS.planCases} cases`);
    return this.qa.addPlanCases(access.workspaceId, planId, ids);
  }

  async removeCaseFromPlan(access: WorkspaceAccess, planId: string, caseId: string): Promise<boolean> {
    await this.editablePlan(access, planId);
    await this.qa.removePlanCase(access.workspaceId, planId, caseId);
    return true;
  }

  async assignCase(access: WorkspaceAccess, planId: string, caseId: string, assigneeId: string | null): Promise<boolean> {
    await this.editablePlan(access, planId);
    if (!(await this.qa.inPlan(access.workspaceId, planId, caseId))) throw DomainError.notFound('Test case in this plan');
    if (assigneeId && !(await this.accessService.resolveMember(assigneeId, access.workspaceId))) throw DomainError.invalid('Pick a member of this workspace');
    await this.qa.assign(access.workspaceId, planId, caseId, assigneeId);
    return true;
  }

  async planCases(access: WorkspaceAccess, planId: string): Promise<QaPlanCaseResponse[]> {
    await this.plan(access, planId);
    return this.qa.planCases(access.workspaceId, planId);
  }

  // ── Runs ──────────────────────────────────────────────────────────────────
  async recordRun(actor: Actor, access: WorkspaceAccess, request: RecordQaRunRequest): Promise<QaPlanCaseResponse> {
    const plan = await this.editablePlan(access, request.planId);
    if (!(await this.qa.inPlan(access.workspaceId, plan.id, request.caseId))) throw DomainError.notFound('Test case in this plan');
    const testCase = await this.getCase(access, request.caseId);
    const result = pick(request.result, QA_RESULTS, 'passed');
    if (result !== request.result) throw DomainError.invalid('Unknown result');
    const stepResults: QaStepResult[] = (request.stepResults ?? []).slice(0, testCase.steps.length).map((step) => ({ result: pick(step.result, QA_RESULTS, 'skipped'), actual: clean(step.actual, QA_LIMITS.stepText) }));
    const actual = clean(request.actual, QA_LIMITS.text);
    const environment = request.environment ? pick<BugEnvironment>(request.environment, BUG_ENVIRONMENTS, 'staging') : null;
    const build = clean(request.build, QA_LIMITS.build) || null;

    const previous = await this.qa.latestRun(access.workspaceId, plan.id, testCase.id);
    const previousBug = previous ? (await this.qa.planCases(access.workspaceId, plan.id)).find((item) => item.caseId === testCase.id)?.bugTaskId ?? null : null;
    let bugTaskId: string | null = null;

    if (result === 'failed') {
      if (previousBug && (await this.moveBug(actor, access, previousBug, 'reopened'))) {
        // A retest that still fails reopens the bug already filed instead of filing another.
        bugTaskId = previousBug;
      } else if (request.fileBug !== false && access.permissions.has('task.create')) {
        bugTaskId = (await this.fileBug(actor, access, plan, testCase, stepResults, actual, environment, build)).taskId;
      }
    } else if (result === 'passed' && previousBug) {
      // A passing retest verifies the fix.
      await this.moveBug(actor, access, previousBug, 'verified');
      bugTaskId = previousBug;
    }

    await this.qa.insertRun({
      workspaceId: access.workspaceId,
      planId: plan.id,
      caseId: testCase.id,
      result,
      stepResults,
      actual,
      environment,
      build,
      bugTaskId,
      retestOf: previous && previous.result !== 'passed' ? previous.id : null,
      executedBy: actor.userId,
    });
    return (await this.qa.planCases(access.workspaceId, plan.id)).find((item) => item.caseId === testCase.id)!;
  }

  // ── Approval, readiness, coverage ─────────────────────────────────────────
  async decide(actor: Actor, access: WorkspaceAccess, planId: string, decision: 'approved' | 'rejected' | 'open', note: string | null): Promise<QaPlanResponse> {
    const plan = await this.getPlan(access, planId);
    SpaceGuard.assert(plan.spaceId, 'space.manage');
    const reason = clean(note, QA_LIMITS.description) || null;
    if (decision === 'approved') {
      const { counts } = plan;
      if (counts.total === 0) throw DomainError.invalid('Add test cases before approving');
      if (counts.notRun > 0) throw DomainError.invalid(`${counts.notRun} case${counts.notRun === 1 ? ' hasn’t' : 's haven’t'} been run yet`);
      // Known failures can ship, but only with a written reason.
      if ((counts.failed > 0 || counts.blocked > 0) && !reason) throw DomainError.invalid('Some cases failed or are blocked: add a note saying why it can still be approved');
    }
    if (decision === 'rejected' && !reason) throw DomainError.invalid('Say why the plan is rejected');
    await this.qa.decide(access.workspaceId, planId, decision, decision === 'open' ? null : actor.userId, decision === 'open' ? null : reason);
    await this.audit.record(actor, { action: `qa_plan.${decision === 'open' ? 'reopen' : decision === 'approved' ? 'approve' : 'reject'}`, targetType: 'qa_plan', targetId: planId, workspaceId: access.workspaceId, metadata: { counts: plan.counts, note: reason } });
    return this.getPlan(access, planId);
  }

  async readiness(access: WorkspaceAccess, planId: string): Promise<QaReadinessResponse> {
    const plan = await this.getPlan(access, planId);
    const openBugs = await this.qa.openBugsFromPlan(access.workspaceId, planId);
    const blocking = openBugs.filter((bug) => bug.severity === 'P0' || bug.severity === 'P1').length;
    const checks = readinessChecks(plan.counts, blocking, plan.status === 'approved');
    return { plan, checks, ready: checks.every((check) => check.ok), openBugs };
  }

  async coverage(access: WorkspaceAccess, spaceId: string): Promise<QaCoverageResponse> {
    await this.space(access, spaceId, 'task.view');
    return this.qa.coverage(access.workspaceId, spaceId);
  }

  // ── Helpers ───────────────────────────────────────────────────────────────
  private async space(access: WorkspaceAccess, spaceId: string, permission: 'task.view' | 'task.update'): Promise<void> {
    await this.spaces.getInWorkspace(access.workspaceId, spaceId);
    SpaceGuard.assert(spaceId, permission);
  }

  private async suite(access: WorkspaceAccess, suiteId: string): Promise<QaSuiteResponse> {
    const suite = await this.qa.findSuite(access.workspaceId, suiteId);
    if (!suite) throw DomainError.notFound('Suite');
    return suite;
  }

  private async plan(access: WorkspaceAccess, planId: string): Promise<PlanRow> {
    const plan = await this.qa.findPlan(access.workspaceId, planId);
    if (!plan) throw DomainError.notFound('Test plan');
    return plan;
  }

  /** Approved plans are frozen: reopen one to change or rerun it. */
  private async editablePlan(access: WorkspaceAccess, planId: string): Promise<PlanRow> {
    const plan = await this.plan(access, planId);
    SpaceGuard.assert(plan.spaceId, 'task.update');
    if (plan.status === 'approved') throw DomainError.conflict('This plan is approved. Reopen it to change it.');
    return plan;
  }

  private async caseFields(access: WorkspaceAccess, spaceId: string, request: SaveQaCaseRequest): Promise<CaseFields> {
    const title = clean(request.title, QA_LIMITS.title);
    if (!title) throw DomainError.invalid('Give the test case a title');
    const steps: QaStep[] = (request.steps ?? [])
      .map((step) => ({ action: clean(step.action, QA_LIMITS.stepText), expected: clean(step.expected, QA_LIMITS.stepText) }))
      .filter((step) => step.action || step.expected);
    if (steps.length > QA_LIMITS.steps) throw DomainError.invalid(`Up to ${QA_LIMITS.steps} steps`);
    const suiteId = request.suiteId ?? null;
    if (suiteId && (await this.suite(access, suiteId)).spaceId !== spaceId) throw DomainError.invalid('Pick a suite of this project');
    const coversTaskId = request.coversTaskId ?? null;
    if (coversTaskId && !(await this.qa.taskInSpace(access.workspaceId, spaceId, coversTaskId))) throw DomainError.invalid('Pick a task of this project');
    return {
      suiteId,
      title,
      preconditions: clean(request.preconditions, QA_LIMITS.text),
      steps,
      priority: pick(request.priority, QA_CASE_PRIORITIES, 'medium'),
      type: pick(request.type, QA_CASE_TYPES, 'functional'),
      status: pick(request.status, QA_CASE_STATUSES, 'ready'),
      coversTaskId,
    };
  }

  private async fileBug(actor: Actor, access: WorkspaceAccess, plan: PlanRow, testCase: QaCaseResponse, stepResults: QaStepResult[], actual: string, environment: BugEnvironment | null, build: string | null) {
    const failedStep = stepResults.findIndex((step) => step.result === 'failed');
    const expected = [testCase.preconditions ? `Preconditions: ${testCase.preconditions}` : '', ...testCase.steps.map((step, index) => (step.expected ? `${index + 1}. ${step.expected}` : ''))].filter(Boolean).join('\n');
    const actualText = [
      failedStep >= 0 ? `Step ${failedStep + 1} failed${stepResults[failedStep]!.actual ? `: ${stepResults[failedStep]!.actual}` : ''}` : '',
      actual,
      `Found by test case C-${testCase.number} in plan “${plan.name}”${plan.release ? ` (release ${plan.release})` : ''}${build ? `, build ${build}` : ''}.`,
    ]
      .filter(Boolean)
      .join('\n\n');
    return this.bugs.report(
      actor,
      access,
      {
        spaceId: plan.spaceId,
        title: `Test failed: C-${testCase.number} ${testCase.title}`.slice(0, 200),
        kind: 'bug',
        severity: QA_PRIORITY_SEVERITY[testCase.priority],
        environment: environment ?? 'staging',
        module: null,
        expected: expected.slice(0, QA_LIMITS.text),
        actual: actualText.slice(0, QA_LIMITS.text),
        steps: testCase.steps.map((step) => step.action).filter(Boolean),
        context: null,
        capture: null,
      },
      'test_run',
    );
  }

  /** Moves a bug filed by an earlier run, when its QA flow allows it (fixed → retest → verified; anything done → reopened). */
  private async moveBug(actor: Actor, access: WorkspaceAccess, taskId: string, to: 'verified' | 'reopened'): Promise<boolean> {
    let bug;
    try {
      bug = await this.bugs.get(access, taskId);
    } catch {
      return false;
    }
    try {
      if (to === 'verified') {
        if (bug.qaState === 'fixed') await this.bugs.setQaState(actor, access, taskId, 'retest');
        if (bug.qaState === 'fixed' || bug.qaState === 'retest') await this.bugs.setQaState(actor, access, taskId, 'verified');
        return true;
      }
      if (['fixed', 'retest', 'verified', 'closed'].includes(bug.qaState)) await this.bugs.setQaState(actor, access, taskId, 'reopened');
      return true;
    } catch {
      return false;
    }
  }
}
