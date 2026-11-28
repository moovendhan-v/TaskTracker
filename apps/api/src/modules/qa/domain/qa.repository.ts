import type {
  QaCasePriority,
  QaCaseResponse,
  QaCaseStatus,
  QaCaseType,
  QaCoverageResponse,
  QaPlanCaseResponse,
  QaPlanCounts,
  QaPlanResponse,
  QaPlanStatus,
  QaResult,
  QaRunResponse,
  QaStep,
  QaStepResult,
  QaSuiteResponse,
} from '@taskflow/shared-types';

export interface CaseFields {
  suiteId: string | null;
  title: string;
  preconditions: string;
  steps: QaStep[];
  priority: QaCasePriority;
  type: QaCaseType;
  status: QaCaseStatus;
  coversTaskId: string | null;
}

export interface PlanFields {
  name: string;
  description: string;
  sprintId: string | null;
  release: string | null;
}

export interface NewRun {
  workspaceId: string;
  planId: string;
  caseId: string;
  result: QaResult;
  stepResults: QaStepResult[];
  actual: string;
  environment: string | null;
  build: string | null;
  bugTaskId: string | null;
  retestOf: string | null;
  executedBy: string;
}

export type PlanRow = Omit<QaPlanResponse, 'counts'>;

/** QA rows of one workspace (row-level security also hides spaces the caller can't see). */
export abstract class QaRepository {
  abstract listSuites(workspaceId: string, spaceId: string): Promise<QaSuiteResponse[]>;
  abstract findSuite(workspaceId: string, suiteId: string): Promise<QaSuiteResponse | null>;
  abstract insertSuite(workspaceId: string, spaceId: string, name: string, description: string): Promise<string>;
  abstract updateSuite(workspaceId: string, suiteId: string, name: string, description: string): Promise<void>;
  abstract deleteSuite(workspaceId: string, suiteId: string): Promise<void>;

  abstract listCases(workspaceId: string, spaceId: string, filter: { suiteId?: string | null; status?: QaCaseStatus | null; search?: string | null }): Promise<QaCaseResponse[]>;
  abstract findCase(workspaceId: string, caseId: string): Promise<QaCaseResponse | null>;
  abstract insertCase(workspaceId: string, spaceId: string, createdBy: string, fields: CaseFields): Promise<string>;
  abstract updateCase(workspaceId: string, caseId: string, fields: CaseFields): Promise<void>;
  abstract deleteCase(workspaceId: string, caseId: string): Promise<void>;
  abstract caseIdsInSpace(workspaceId: string, spaceId: string, caseIds: readonly string[]): Promise<string[]>;
  abstract readyCaseIds(workspaceId: string, spaceId: string, suiteId: string | null): Promise<string[]>;
  abstract taskInSpace(workspaceId: string, spaceId: string, taskId: string): Promise<boolean>;
  abstract sprintInSpace(workspaceId: string, spaceId: string, sprintId: string): Promise<boolean>;

  abstract listPlans(workspaceId: string, spaceId: string): Promise<PlanRow[]>;
  abstract findPlan(workspaceId: string, planId: string): Promise<PlanRow | null>;
  abstract insertPlan(workspaceId: string, spaceId: string, createdBy: string, fields: PlanFields): Promise<string>;
  abstract updatePlan(workspaceId: string, planId: string, fields: PlanFields): Promise<void>;
  abstract deletePlan(workspaceId: string, planId: string): Promise<void>;
  abstract addPlanCases(workspaceId: string, planId: string, caseIds: readonly string[]): Promise<number>;
  abstract removePlanCase(workspaceId: string, planId: string, caseId: string): Promise<void>;
  abstract planCaseCount(workspaceId: string, planId: string): Promise<number>;
  abstract inPlan(workspaceId: string, planId: string, caseId: string): Promise<boolean>;
  abstract assign(workspaceId: string, planId: string, caseId: string, assigneeId: string | null): Promise<void>;
  abstract planCases(workspaceId: string, planId: string): Promise<QaPlanCaseResponse[]>;
  abstract counts(workspaceId: string, planIds: readonly string[]): Promise<Map<string, QaPlanCounts>>;
  abstract decide(workspaceId: string, planId: string, status: QaPlanStatus, by: string | null, note: string | null): Promise<void>;

  abstract insertRun(run: NewRun): Promise<string>;
  abstract latestRun(workspaceId: string, planId: string, caseId: string): Promise<{ id: string; result: QaResult } | null>;
  abstract runsForCase(workspaceId: string, caseId: string, limit: number): Promise<QaRunResponse[]>;
  abstract openBugsFromPlan(workspaceId: string, planId: string): Promise<{ taskId: string; number: number; title: string; severity: string; qaState: string }[]>;
  abstract coverage(workspaceId: string, spaceId: string): Promise<QaCoverageResponse>;
}
