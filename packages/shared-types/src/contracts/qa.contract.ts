import type { BugEnvironment } from '../domain/bug.js';
import type { QaCasePriority, QaCaseStatus, QaCaseType, QaPlanCounts, QaPlanStatus, QaResult, QaStep, QaStepResult, ReadinessCheck } from '../domain/qa.js';

export interface QaSuiteResponse {
  id: string;
  spaceId: string;
  name: string;
  description: string;
  caseCount: number;
}

export interface QaCaseResponse {
  id: string;
  spaceId: string;
  suiteId: string | null;
  number: number;
  title: string;
  preconditions: string;
  steps: QaStep[];
  priority: QaCasePriority;
  type: QaCaseType;
  status: QaCaseStatus;
  coversTaskId: string | null;
  coversTaskTitle: string | null;
  /** The latest result anywhere, and when. */
  lastResult: QaResult | null;
  lastRunAt: string | null;
  updatedAt: string;
}

export interface SaveQaCaseRequest {
  suiteId?: string | null;
  title: string;
  preconditions?: string | null;
  steps: QaStep[];
  priority?: QaCasePriority | null;
  type?: QaCaseType | null;
  status?: QaCaseStatus | null;
  coversTaskId?: string | null;
}

export interface QaPlanResponse {
  id: string;
  spaceId: string;
  name: string;
  description: string;
  sprintId: string | null;
  release: string | null;
  status: QaPlanStatus;
  decidedByName: string | null;
  decidedAt: string | null;
  decisionNote: string | null;
  counts: QaPlanCounts;
  createdAt: string;
}

export interface SaveQaPlanRequest {
  name: string;
  description?: string | null;
  sprintId?: string | null;
  release?: string | null;
}

/** One case in a plan, with its current (latest) result. */
export interface QaPlanCaseResponse {
  caseId: string;
  number: number;
  title: string;
  priority: QaCasePriority;
  type: QaCaseType;
  suiteName: string | null;
  assigneeId: string | null;
  result: QaResult | null;
  runId: string | null;
  executedAt: string | null;
  executedByName: string | null;
  bugTaskId: string | null;
  bugNumber: number | null;
  bugQaState: string | null;
  runs: number;
}

export interface QaRunResponse {
  id: string;
  planId: string;
  planName: string;
  caseId: string;
  result: QaResult;
  stepResults: QaStepResult[];
  actual: string;
  environment: BugEnvironment | null;
  build: string | null;
  bugTaskId: string | null;
  bugNumber: number | null;
  retestOf: string | null;
  executedByName: string | null;
  executedAt: string;
}

export interface RecordQaRunRequest {
  planId: string;
  caseId: string;
  result: QaResult;
  stepResults?: QaStepResult[] | null;
  actual?: string | null;
  environment?: BugEnvironment | null;
  build?: string | null;
  /** On a failure, file a bug with the run's details (default true). */
  fileBug?: boolean | null;
}

export interface QaReadinessResponse {
  plan: QaPlanResponse;
  checks: ReadinessCheck[];
  ready: boolean;
  openBugs: { taskId: string; number: number; title: string; severity: string; qaState: string }[];
}

export interface QaCoverageResponse {
  /** Features in the project covered by at least one ready test case. */
  features: number;
  coveredFeatures: number;
  uncovered: { taskId: string; number: number; title: string }[];
  cases: number;
  readyCases: number;
  neverRun: number;
  /** Cases that both passed and failed in their last five runs. */
  flaky: { caseId: string; number: number; title: string }[];
}
