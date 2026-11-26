import type { BugCaptureResponse, BugEnvironment, BugFilter, BugKind, BugQaState, BugSeverity, BugSource, BugStep, SimilarBugResponse } from '@taskflow/shared-types';
import type { CleanCapture } from './bug.policy.js';

export interface BugRecord {
  taskId: string;
  workspaceId: string;
  kind: BugKind;
  severity: BugSeverity;
  environment: BugEnvironment;
  module: string | null;
  expected: string;
  actual: string;
  steps: BugStep[];
  qaState: BugQaState;
  source: BugSource;
  pageUrl: string | null;
  browser: string | null;
  os: string | null;
  viewport: string | null;
  userAgent: string | null;
  reporterId: string | null;
  reporterName: string | null;
  reporterEmail: string | null;
  consoleErrors: number;
  failedRequests: number;
  duplicateOfTaskId: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export type NewBugRecord = Omit<BugRecord, 'consoleErrors' | 'failedRequests' | 'duplicateOfTaskId' | 'createdAt' | 'updatedAt'>;
export type BugChanges = Partial<Pick<BugRecord, 'kind' | 'severity' | 'environment' | 'module' | 'expected' | 'actual' | 'steps' | 'qaState'>>;

export abstract class BugRepository {
  abstract insert(record: NewBugRecord, capture: CleanCapture): Promise<void>;
  abstract find(workspaceId: string, taskId: string): Promise<BugRecord | null>;
  abstract list(workspaceId: string, spaceId: string, filter: BugFilter, limit: number): Promise<BugRecord[]>;
  abstract update(workspaceId: string, taskId: string, changes: BugChanges): Promise<void>;
  abstract capture(workspaceId: string, taskId: string): Promise<BugCaptureResponse | null>;
  /** Open-or-closed bug reports in the space whose titles look like this one. */
  abstract similar(workspaceId: string, spaceId: string, title: string, excludeTaskId: string | null, limit: number): Promise<SimilarBugResponse[]>;
}
