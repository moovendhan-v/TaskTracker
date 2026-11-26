import type { ActionEntry, BugEnvironment, BugEnvironmentInfo, BugKind, BugQaState, BugSeverity, BugSource, BugStep, ConsoleEntry, NetworkEntry } from '../domain/bug.js';
import type { TaskPriority } from '../domain/task.js';

export interface BugResponse {
  taskId: string;
  number: number;
  title: string;
  spaceId: string;
  listId: string;
  statusName: string;
  statusCategory: string;
  priority: TaskPriority;
  assigneeIds: string[];
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
  reporterId: string | null;
  reporterName: string | null;
  /** The report this one duplicates, if marked. */
  duplicateOfTaskId: string | null;
  consoleErrors: number;
  failedRequests: number;
  createdAt: string;
  updatedAt: string;
}

export interface BugCaptureResponse {
  console: ConsoleEntry[];
  network: NetworkEntry[];
  actions: ActionEntry[];
}

export interface BugCaptureInput {
  console?: ConsoleEntry[] | null;
  network?: NetworkEntry[] | null;
  actions?: ActionEntry[] | null;
}

export interface ReportBugRequest {
  spaceId: string;
  /** A list of the project; its default list when left out. */
  listId?: string | null;
  title: string;
  kind?: BugKind | null;
  severity?: BugSeverity | null;
  environment?: BugEnvironment | null;
  module?: string | null;
  expected?: string | null;
  actual?: string | null;
  /** Steps typed by the reporter; captured actions add their own. */
  steps?: string[] | null;
  context?: Partial<BugEnvironmentInfo> | null;
  capture?: BugCaptureInput | null;
}

export interface UpdateBugRequest {
  kind?: BugKind | null;
  severity?: BugSeverity | null;
  environment?: BugEnvironment | null;
  module?: string | null;
  expected?: string | null;
  actual?: string | null;
  steps?: BugStep[] | null;
}

export interface BugFilter {
  kinds?: BugKind[] | null;
  severities?: BugSeverity[] | null;
  environments?: BugEnvironment[] | null;
  qaStates?: BugQaState[] | null;
  search?: string | null;
}

export interface SimilarBugResponse {
  taskId: string;
  number: number;
  title: string;
  qaState: BugQaState;
  /** 0–1, title similarity. */
  score: number;
}
