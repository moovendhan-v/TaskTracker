import { Injectable } from '@nestjs/common';
import type { QaCaseResponse, QaCoverageResponse, QaPlanCaseResponse, QaPlanCounts, QaPlanStatus, QaResult, QaRunResponse, QaSuiteResponse } from '@taskflow/shared-types';
import { TransactionalManager } from '../../../core/database/transactional-manager.js';
import { QaRepository, type CaseFields, type NewRun, type PlanFields, type PlanRow } from '../domain/qa.repository.js';

type Row = Record<string, unknown>;
/** UPDATE … RETURNING comes back from TypeORM as [rows, count]. */
const rowsOf = (result: unknown): Row[] => (Array.isArray(result) && Array.isArray(result[0]) ? (result[0] as Row[]) : (result as Row[]));
const iso = (value: unknown) => (value ? new Date(value as string).toISOString() : null);
const str = (value: unknown) => (value as string | null) ?? null;

/** The latest run of each case in each plan. */
const LATEST = `SELECT DISTINCT ON (r.plan_id, r.case_id) r.* FROM qa_run r WHERE r.workspace_id = $1 ORDER BY r.plan_id, r.case_id, r.executed_at DESC, r.id DESC`;

const CASE_COLUMNS = `c.id, c.space_id, c.suite_id, c.number, c.title, c.preconditions, c.steps, c.priority, c.type, c.status, c.covers_task_id, t.title AS covers_title, c.updated_at,
  (SELECT r.result FROM qa_run r WHERE r.workspace_id = c.workspace_id AND r.case_id = c.id ORDER BY r.executed_at DESC LIMIT 1) AS last_result,
  (SELECT max(r.executed_at) FROM qa_run r WHERE r.workspace_id = c.workspace_id AND r.case_id = c.id) AS last_run_at`;

const toCase = (row: Row): QaCaseResponse => ({
  id: row['id'] as string,
  spaceId: row['space_id'] as string,
  suiteId: str(row['suite_id']),
  number: Number(row['number']),
  title: row['title'] as string,
  preconditions: row['preconditions'] as string,
  steps: (row['steps'] as QaCaseResponse['steps']) ?? [],
  priority: row['priority'] as QaCaseResponse['priority'],
  type: row['type'] as QaCaseResponse['type'],
  status: row['status'] as QaCaseResponse['status'],
  coversTaskId: str(row['covers_task_id']),
  coversTaskTitle: str(row['covers_title']),
  lastResult: str(row['last_result']) as QaResult | null,
  lastRunAt: iso(row['last_run_at']),
  updatedAt: new Date(row['updated_at'] as string).toISOString(),
});

const PLAN_COLUMNS = `p.id, p.space_id, p.name, p.description, p.sprint_id, p.release, p.status, u.name AS decided_by_name, p.decided_at, p.decision_note, p.created_at`;
const toPlan = (row: Row): PlanRow => ({
  id: row['id'] as string,
  spaceId: row['space_id'] as string,
  name: row['name'] as string,
  description: row['description'] as string,
  sprintId: str(row['sprint_id']),
  release: str(row['release']),
  status: row['status'] as QaPlanStatus,
  decidedByName: str(row['decided_by_name']),
  decidedAt: iso(row['decided_at']),
  decisionNote: str(row['decision_note']),
  createdAt: new Date(row['created_at'] as string).toISOString(),
});

@Injectable()
export class TypeOrmQaRepository extends QaRepository {
  constructor(private readonly transactional: TransactionalManager) {
    super();
  }

  private async rows(sql: string, params: unknown[]): Promise<Row[]> {
    return rowsOf(await this.transactional.manager.query(sql, params));
  }

  // ── Suites ────────────────────────────────────────────────────────────────
  async listSuites(workspaceId: string, spaceId: string): Promise<QaSuiteResponse[]> {
    const rows = await this.rows(
      `SELECT s.id, s.space_id, s.name, s.description, (SELECT count(*)::int FROM qa_case c WHERE c.suite_id = s.id AND c.status <> 'deprecated') AS case_count
         FROM qa_suite s WHERE s.workspace_id = $1 AND s.space_id = $2 ORDER BY lower(s.name)`,
      [workspaceId, spaceId],
    );
    return rows.map((row) => ({ id: row['id'] as string, spaceId: row['space_id'] as string, name: row['name'] as string, description: row['description'] as string, caseCount: Number(row['case_count']) }));
  }

  async findSuite(workspaceId: string, suiteId: string): Promise<QaSuiteResponse | null> {
    const [row] = await this.rows(`SELECT id, space_id, name, description FROM qa_suite WHERE workspace_id = $1 AND id = $2`, [workspaceId, suiteId]);
    return row ? { id: row['id'] as string, spaceId: row['space_id'] as string, name: row['name'] as string, description: row['description'] as string, caseCount: 0 } : null;
  }

  async insertSuite(workspaceId: string, spaceId: string, name: string, description: string): Promise<string> {
    const [row] = await this.rows(`INSERT INTO qa_suite (workspace_id, space_id, name, description) VALUES ($1, $2, $3, $4) RETURNING id`, [workspaceId, spaceId, name, description]);
    return row!['id'] as string;
  }

  async updateSuite(workspaceId: string, suiteId: string, name: string, description: string): Promise<void> {
    await this.rows(`UPDATE qa_suite SET name = $3, description = $4 WHERE workspace_id = $1 AND id = $2`, [workspaceId, suiteId, name, description]);
  }

  async deleteSuite(workspaceId: string, suiteId: string): Promise<void> {
    await this.rows(`DELETE FROM qa_suite WHERE workspace_id = $1 AND id = $2`, [workspaceId, suiteId]);
  }

  // ── Cases ─────────────────────────────────────────────────────────────────
  async listCases(workspaceId: string, spaceId: string, filter: { suiteId?: string | null; status?: string | null; search?: string | null }): Promise<QaCaseResponse[]> {
    const search = filter.search?.trim().slice(0, 100) || null;
    const rows = await this.rows(
      `SELECT ${CASE_COLUMNS} FROM qa_case c LEFT JOIN task t ON t.id = c.covers_task_id
        WHERE c.workspace_id = $1 AND c.space_id = $2
          AND ($3::uuid IS NULL OR c.suite_id = $3)
          AND ($4::text IS NULL OR c.status = $4)
          AND ($5::text IS NULL OR c.title ILIKE '%' || $5 || '%' OR ('C-' || c.number::text) ILIKE $5)
        ORDER BY c.number LIMIT 1000`,
      [workspaceId, spaceId, filter.suiteId ?? null, filter.status ?? null, search?.replace(/[\\%_]/g, (char) => `\\${char}`) ?? null],
    );
    return rows.map(toCase);
  }

  async findCase(workspaceId: string, caseId: string): Promise<QaCaseResponse | null> {
    const [row] = await this.rows(`SELECT ${CASE_COLUMNS} FROM qa_case c LEFT JOIN task t ON t.id = c.covers_task_id WHERE c.workspace_id = $1 AND c.id = $2`, [workspaceId, caseId]);
    return row ? toCase(row) : null;
  }

  async insertCase(workspaceId: string, spaceId: string, createdBy: string, fields: CaseFields): Promise<string> {
    // Numbers per project (C-1, C-2…); a transaction lock per project so two inserts can't take the same one.
    await this.rows(`SELECT pg_advisory_xact_lock(hashtext('qa_case:' || $1::text))`, [spaceId]);
    const [row] = await this.rows(
      `INSERT INTO qa_case (workspace_id, space_id, suite_id, number, title, preconditions, steps, priority, type, status, covers_task_id, created_by)
       VALUES ($1, $2, $3, (SELECT coalesce(max(number), 0) + 1 FROM qa_case WHERE space_id = $2), $4, $5, $6::jsonb, $7, $8, $9, $10, $11) RETURNING id`,
      [workspaceId, spaceId, fields.suiteId, fields.title, fields.preconditions, JSON.stringify(fields.steps), fields.priority, fields.type, fields.status, fields.coversTaskId, createdBy],
    );
    return row!['id'] as string;
  }

  async updateCase(workspaceId: string, caseId: string, fields: CaseFields): Promise<void> {
    await this.rows(
      `UPDATE qa_case SET suite_id = $3, title = $4, preconditions = $5, steps = $6::jsonb, priority = $7, type = $8, status = $9, covers_task_id = $10, updated_at = now()
        WHERE workspace_id = $1 AND id = $2`,
      [workspaceId, caseId, fields.suiteId, fields.title, fields.preconditions, JSON.stringify(fields.steps), fields.priority, fields.type, fields.status, fields.coversTaskId],
    );
  }

  async deleteCase(workspaceId: string, caseId: string): Promise<void> {
    await this.rows(`DELETE FROM qa_case WHERE workspace_id = $1 AND id = $2`, [workspaceId, caseId]);
  }

  async caseIdsInSpace(workspaceId: string, spaceId: string, caseIds: readonly string[]): Promise<string[]> {
    const rows = await this.rows(`SELECT id FROM qa_case WHERE workspace_id = $1 AND space_id = $2 AND id = ANY($3::uuid[]) AND status <> 'deprecated'`, [workspaceId, spaceId, [...caseIds]]);
    return rows.map((row) => row['id'] as string);
  }

  async readyCaseIds(workspaceId: string, spaceId: string, suiteId: string | null): Promise<string[]> {
    const rows = await this.rows(`SELECT id FROM qa_case WHERE workspace_id = $1 AND space_id = $2 AND status = 'ready' AND ($3::uuid IS NULL OR suite_id = $3) ORDER BY number`, [workspaceId, spaceId, suiteId]);
    return rows.map((row) => row['id'] as string);
  }

  async taskInSpace(workspaceId: string, spaceId: string, taskId: string): Promise<boolean> {
    return (await this.rows(`SELECT 1 FROM task WHERE workspace_id = $1 AND space_id = $2 AND id = $3`, [workspaceId, spaceId, taskId])).length > 0;
  }

  async sprintInSpace(workspaceId: string, spaceId: string, sprintId: string): Promise<boolean> {
    return (await this.rows(`SELECT 1 FROM sprint WHERE workspace_id = $1 AND space_id = $2 AND id = $3`, [workspaceId, spaceId, sprintId])).length > 0;
  }

  // ── Plans ─────────────────────────────────────────────────────────────────
  async listPlans(workspaceId: string, spaceId: string): Promise<PlanRow[]> {
    const rows = await this.rows(`SELECT ${PLAN_COLUMNS} FROM qa_plan p LEFT JOIN "user" u ON u.id = p.decided_by WHERE p.workspace_id = $1 AND p.space_id = $2 ORDER BY p.created_at DESC LIMIT 200`, [workspaceId, spaceId]);
    return rows.map(toPlan);
  }

  async findPlan(workspaceId: string, planId: string): Promise<PlanRow | null> {
    const [row] = await this.rows(`SELECT ${PLAN_COLUMNS} FROM qa_plan p LEFT JOIN "user" u ON u.id = p.decided_by WHERE p.workspace_id = $1 AND p.id = $2`, [workspaceId, planId]);
    return row ? toPlan(row) : null;
  }

  async insertPlan(workspaceId: string, spaceId: string, createdBy: string, fields: PlanFields): Promise<string> {
    const [row] = await this.rows(
      `INSERT INTO qa_plan (workspace_id, space_id, name, description, sprint_id, release, created_by) VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id`,
      [workspaceId, spaceId, fields.name, fields.description, fields.sprintId, fields.release, createdBy],
    );
    return row!['id'] as string;
  }

  async updatePlan(workspaceId: string, planId: string, fields: PlanFields): Promise<void> {
    await this.rows(`UPDATE qa_plan SET name = $3, description = $4, sprint_id = $5, release = $6 WHERE workspace_id = $1 AND id = $2`, [workspaceId, planId, fields.name, fields.description, fields.sprintId, fields.release]);
  }

  async deletePlan(workspaceId: string, planId: string): Promise<void> {
    await this.rows(`DELETE FROM qa_plan WHERE workspace_id = $1 AND id = $2`, [workspaceId, planId]);
  }

  async addPlanCases(workspaceId: string, planId: string, caseIds: readonly string[]): Promise<number> {
    const rows = await this.rows(
      `INSERT INTO qa_plan_case (plan_id, case_id, workspace_id) SELECT $2, unnest($3::uuid[]), $1 ON CONFLICT DO NOTHING RETURNING case_id`,
      [workspaceId, planId, [...caseIds]],
    );
    return rows.length;
  }

  async removePlanCase(workspaceId: string, planId: string, caseId: string): Promise<void> {
    await this.rows(`DELETE FROM qa_plan_case WHERE workspace_id = $1 AND plan_id = $2 AND case_id = $3`, [workspaceId, planId, caseId]);
  }

  async planCaseCount(workspaceId: string, planId: string): Promise<number> {
    const [row] = await this.rows(`SELECT count(*)::int AS n FROM qa_plan_case WHERE workspace_id = $1 AND plan_id = $2`, [workspaceId, planId]);
    return Number(row?.['n'] ?? 0);
  }

  async inPlan(workspaceId: string, planId: string, caseId: string): Promise<boolean> {
    return (await this.rows(`SELECT 1 FROM qa_plan_case WHERE workspace_id = $1 AND plan_id = $2 AND case_id = $3`, [workspaceId, planId, caseId])).length > 0;
  }

  async assign(workspaceId: string, planId: string, caseId: string, assigneeId: string | null): Promise<void> {
    await this.rows(`UPDATE qa_plan_case SET assignee_id = $4 WHERE workspace_id = $1 AND plan_id = $2 AND case_id = $3`, [workspaceId, planId, caseId, assigneeId]);
  }

  async planCases(workspaceId: string, planId: string): Promise<QaPlanCaseResponse[]> {
    const rows = await this.rows(
      `WITH latest AS (${LATEST})
       SELECT c.id AS case_id, c.number, c.title, c.priority, c.type, s.name AS suite_name, pc.assignee_id,
              l.result, l.id AS run_id, l.executed_at, u.name AS executed_by_name, l.bug_task_id, bt.number AS bug_number, br.qa_state AS bug_qa_state,
              (SELECT count(*)::int FROM qa_run r WHERE r.workspace_id = $1 AND r.plan_id = pc.plan_id AND r.case_id = c.id) AS runs
         FROM qa_plan_case pc
         JOIN qa_case c ON c.id = pc.case_id
         LEFT JOIN qa_suite s ON s.id = c.suite_id
         LEFT JOIN latest l ON l.plan_id = pc.plan_id AND l.case_id = c.id
         LEFT JOIN "user" u ON u.id = l.executed_by
         LEFT JOIN task bt ON bt.id = l.bug_task_id
         LEFT JOIN bug_report br ON br.task_id = l.bug_task_id
        WHERE pc.workspace_id = $1 AND pc.plan_id = $2
        ORDER BY s.name NULLS FIRST, c.number`,
      [workspaceId, planId],
    );
    return rows.map((row) => ({
      caseId: row['case_id'] as string,
      number: Number(row['number']),
      title: row['title'] as string,
      priority: row['priority'] as QaPlanCaseResponse['priority'],
      type: row['type'] as QaPlanCaseResponse['type'],
      suiteName: str(row['suite_name']),
      assigneeId: str(row['assignee_id']),
      result: str(row['result']) as QaResult | null,
      runId: str(row['run_id']),
      executedAt: iso(row['executed_at']),
      executedByName: str(row['executed_by_name']),
      bugTaskId: str(row['bug_task_id']),
      bugNumber: row['bug_number'] === null || row['bug_number'] === undefined ? null : Number(row['bug_number']),
      bugQaState: str(row['bug_qa_state']),
      runs: Number(row['runs']),
    }));
  }

  async counts(workspaceId: string, planIds: readonly string[]): Promise<Map<string, QaPlanCounts>> {
    const rows = await this.rows(
      `WITH latest AS (${LATEST})
       SELECT pc.plan_id, count(*)::int AS total,
              count(*) FILTER (WHERE l.result = 'passed')::int AS passed,
              count(*) FILTER (WHERE l.result = 'failed')::int AS failed,
              count(*) FILTER (WHERE l.result = 'blocked')::int AS blocked,
              count(*) FILTER (WHERE l.result = 'skipped')::int AS skipped,
              count(*) FILTER (WHERE l.result IS NULL)::int AS not_run
         FROM qa_plan_case pc LEFT JOIN latest l ON l.plan_id = pc.plan_id AND l.case_id = pc.case_id
        WHERE pc.workspace_id = $1 AND pc.plan_id = ANY($2::uuid[])
        GROUP BY pc.plan_id`,
      [workspaceId, [...planIds]],
    );
    const counts = new Map<string, QaPlanCounts>();
    for (const id of planIds) counts.set(id, { total: 0, passed: 0, failed: 0, blocked: 0, skipped: 0, notRun: 0 });
    for (const row of rows) {
      counts.set(row['plan_id'] as string, {
        total: Number(row['total']),
        passed: Number(row['passed']),
        failed: Number(row['failed']),
        blocked: Number(row['blocked']),
        skipped: Number(row['skipped']),
        notRun: Number(row['not_run']),
      });
    }
    return counts;
  }

  async decide(workspaceId: string, planId: string, status: QaPlanStatus, by: string | null, note: string | null): Promise<void> {
    await this.rows(
      `UPDATE qa_plan SET status = $3::text, decided_by = $4, decided_at = CASE WHEN $3::text = 'open' THEN NULL ELSE now() END, decision_note = $5 WHERE workspace_id = $1 AND id = $2`,
      [workspaceId, planId, status, by, note],
    );
  }

  // ── Runs ──────────────────────────────────────────────────────────────────
  async insertRun(run: NewRun): Promise<string> {
    const [row] = await this.rows(
      `INSERT INTO qa_run (workspace_id, plan_id, case_id, result, step_results, actual, environment, build, bug_task_id, retest_of, executed_by)
       VALUES ($1, $2, $3, $4, $5::jsonb, $6, $7, $8, $9, $10, $11) RETURNING id`,
      [run.workspaceId, run.planId, run.caseId, run.result, JSON.stringify(run.stepResults), run.actual, run.environment, run.build, run.bugTaskId, run.retestOf, run.executedBy],
    );
    return row!['id'] as string;
  }

  async latestRun(workspaceId: string, planId: string, caseId: string): Promise<{ id: string; result: QaResult } | null> {
    const [row] = await this.rows(`SELECT id, result FROM qa_run WHERE workspace_id = $1 AND plan_id = $2 AND case_id = $3 ORDER BY executed_at DESC, id DESC LIMIT 1`, [workspaceId, planId, caseId]);
    return row ? { id: row['id'] as string, result: row['result'] as QaResult } : null;
  }

  async runsForCase(workspaceId: string, caseId: string, limit: number): Promise<QaRunResponse[]> {
    const rows = await this.rows(
      `SELECT r.id, r.plan_id, p.name AS plan_name, r.case_id, r.result, r.step_results, r.actual, r.environment, r.build, r.bug_task_id, bt.number AS bug_number, r.retest_of, u.name AS executed_by_name, r.executed_at
         FROM qa_run r JOIN qa_plan p ON p.id = r.plan_id LEFT JOIN "user" u ON u.id = r.executed_by LEFT JOIN task bt ON bt.id = r.bug_task_id
        WHERE r.workspace_id = $1 AND r.case_id = $2 ORDER BY r.executed_at DESC, r.id DESC LIMIT $3`,
      [workspaceId, caseId, limit],
    );
    return rows.map((row) => ({
      id: row['id'] as string,
      planId: row['plan_id'] as string,
      planName: row['plan_name'] as string,
      caseId: row['case_id'] as string,
      result: row['result'] as QaResult,
      stepResults: (row['step_results'] as QaRunResponse['stepResults']) ?? [],
      actual: row['actual'] as string,
      environment: str(row['environment']) as QaRunResponse['environment'],
      build: str(row['build']),
      bugTaskId: str(row['bug_task_id']),
      bugNumber: row['bug_number'] === null || row['bug_number'] === undefined ? null : Number(row['bug_number']),
      retestOf: str(row['retest_of']),
      executedByName: str(row['executed_by_name']),
      executedAt: new Date(row['executed_at'] as string).toISOString(),
    }));
  }

  async openBugsFromPlan(workspaceId: string, planId: string): Promise<{ taskId: string; number: number; title: string; severity: string; qaState: string }[]> {
    const rows = await this.rows(
      `SELECT DISTINCT t.id, t.number, t.title, b.severity, b.qa_state
         FROM qa_run r JOIN task t ON t.id = r.bug_task_id JOIN bug_report b ON b.task_id = t.id
        WHERE r.workspace_id = $1 AND r.plan_id = $2 AND b.qa_state NOT IN ('verified', 'closed', 'duplicate', 'wont_fix')
        ORDER BY b.severity, t.number`,
      [workspaceId, planId],
    );
    return rows.map((row) => ({ taskId: row['id'] as string, number: Number(row['number']), title: row['title'] as string, severity: row['severity'] as string, qaState: row['qa_state'] as string }));
  }

  async coverage(workspaceId: string, spaceId: string): Promise<QaCoverageResponse> {
    const features = await this.rows(
      `SELECT t.id, t.number, t.title, EXISTS (SELECT 1 FROM qa_case c WHERE c.covers_task_id = t.id AND c.status = 'ready') AS covered
         FROM task t WHERE t.workspace_id = $1 AND t.space_id = $2 AND t.type = 'feature' ORDER BY t.number`,
      [workspaceId, spaceId],
    );
    const [cases] = await this.rows(
      `SELECT count(*)::int AS total, count(*) FILTER (WHERE status = 'ready')::int AS ready,
              count(*) FILTER (WHERE status = 'ready' AND NOT EXISTS (SELECT 1 FROM qa_run r WHERE r.case_id = c.id))::int AS never_run
         FROM qa_case c WHERE c.workspace_id = $1 AND c.space_id = $2`,
      [workspaceId, spaceId],
    );
    const flaky = await this.rows(
      `WITH recent AS (
         SELECT r.case_id, r.result, row_number() OVER (PARTITION BY r.case_id ORDER BY r.executed_at DESC) AS n
           FROM qa_run r JOIN qa_case c ON c.id = r.case_id WHERE r.workspace_id = $1 AND c.space_id = $2)
       SELECT c.id, c.number, c.title FROM qa_case c
        WHERE c.workspace_id = $1 AND c.space_id = $2
          AND EXISTS (SELECT 1 FROM recent WHERE recent.case_id = c.id AND n <= 5 AND result = 'passed')
          AND EXISTS (SELECT 1 FROM recent WHERE recent.case_id = c.id AND n <= 5 AND result = 'failed')
        ORDER BY c.number LIMIT 50`,
      [workspaceId, spaceId],
    );
    return {
      features: features.length,
      coveredFeatures: features.filter((row) => row['covered']).length,
      uncovered: features.filter((row) => !row['covered']).slice(0, 50).map((row) => ({ taskId: row['id'] as string, number: Number(row['number']), title: row['title'] as string })),
      cases: Number(cases?.['total'] ?? 0),
      readyCases: Number(cases?.['ready'] ?? 0),
      neverRun: Number(cases?.['never_run'] ?? 0),
      flaky: flaky.map((row) => ({ caseId: row['id'] as string, number: Number(row['number']), title: row['title'] as string })),
    };
  }
}
