import type { BugSeverity } from './bug.js';

/**
 * E6.4 QA test management: suites of test cases, plans that run them for a sprint or release,
 * and the results of every run. Modelled on the case → suite → plan → run flow common to test
 * management tools; written for TaskFlow.
 */
export const QA_CASE_PRIORITIES = ['critical', 'high', 'medium', 'low'] as const;
export type QaCasePriority = (typeof QA_CASE_PRIORITIES)[number];
export const QA_CASE_PRIORITY_LABELS: Record<QaCasePriority, string> = { critical: 'Critical', high: 'High', medium: 'Medium', low: 'Low' };

export const QA_CASE_TYPES = ['functional', 'regression', 'smoke', 'security', 'performance', 'usability', 'accessibility', 'other'] as const;
export type QaCaseType = (typeof QA_CASE_TYPES)[number];
export const QA_CASE_TYPE_LABELS: Record<QaCaseType, string> = {
  functional: 'Functional',
  regression: 'Regression',
  smoke: 'Smoke',
  security: 'Security',
  performance: 'Performance',
  usability: 'Usability',
  accessibility: 'Accessibility',
  other: 'Other',
};

export const QA_CASE_STATUSES = ['draft', 'ready', 'deprecated'] as const;
export type QaCaseStatus = (typeof QA_CASE_STATUSES)[number];

export const QA_RESULTS = ['passed', 'failed', 'blocked', 'skipped'] as const;
export type QaResult = (typeof QA_RESULTS)[number];
export const QA_RESULT_LABELS: Record<QaResult, string> = { passed: 'Passed', failed: 'Failed', blocked: 'Blocked', skipped: 'Skipped' };

export const QA_PLAN_STATUSES = ['open', 'approved', 'rejected'] as const;
export type QaPlanStatus = (typeof QA_PLAN_STATUSES)[number];

/** A failed case files a bug; its severity follows the case's priority. */
export const QA_PRIORITY_SEVERITY: Record<QaCasePriority, BugSeverity> = { critical: 'P1', high: 'P2', medium: 'P3', low: 'P4' };

export interface QaStep {
  action: string;
  expected: string;
}

export interface QaStepResult {
  result: QaResult;
  actual: string;
}

export const QA_LIMITS = {
  title: 200,
  name: 120,
  text: 5_000,
  description: 2_000,
  steps: 50,
  stepText: 1_000,
  release: 60,
  build: 60,
  planCases: 1_000,
} as const;

export interface QaPlanCounts {
  total: number;
  passed: number;
  failed: number;
  blocked: number;
  skipped: number;
  notRun: number;
}

/** Done when every case has a result; the pass rate counts only cases that ran (not skipped). */
export function planProgress(counts: QaPlanCounts): { done: number; passRate: number | null } {
  const ran = counts.passed + counts.failed + counts.blocked;
  return {
    done: counts.total ? Math.round(((counts.total - counts.notRun) / counts.total) * 100) : 0,
    passRate: ran ? Math.round((counts.passed / ran) * 100) : null,
  };
}

export interface ReadinessCheck {
  key: 'all_run' | 'no_failures' | 'no_blocked' | 'no_open_blockers' | 'approved';
  ok: boolean;
  detail: string;
}

/** Ready to release when every check passes. */
export function readinessChecks(counts: QaPlanCounts, openBlockingBugs: number, approved: boolean): ReadinessCheck[] {
  return [
    { key: 'all_run', ok: counts.notRun === 0 && counts.total > 0, detail: counts.total === 0 ? 'The plan has no test cases' : counts.notRun ? `${counts.notRun} of ${counts.total} not run yet` : `All ${counts.total} run` },
    { key: 'no_failures', ok: counts.failed === 0, detail: counts.failed ? `${counts.failed} failing` : 'Nothing failing' },
    { key: 'no_blocked', ok: counts.blocked === 0, detail: counts.blocked ? `${counts.blocked} blocked` : 'Nothing blocked' },
    { key: 'no_open_blockers', ok: openBlockingBugs === 0, detail: openBlockingBugs ? `${openBlockingBugs} open P0/P1 bug${openBlockingBugs === 1 ? '' : 's'} from this plan` : 'No open P0/P1 bugs from this plan' },
    { key: 'approved', ok: approved, detail: approved ? 'Approved by QA' : 'Waiting for QA approval' },
  ];
}
