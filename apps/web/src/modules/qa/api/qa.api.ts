import {
  AddQaPlanCasesDocument,
  DecideQaPlanDocument,
  DeleteQaCaseDocument,
  DeleteQaPlanDocument,
  DeleteQaSuiteDocument,
  QaCaseRunsDocument,
  QaCasesDocument,
  QaCoverageDocument,
  QaPlanCasesDocument,
  QaPlansDocument,
  QaReadinessDocument,
  QaSuitesDocument,
  RecordQaRunDocument,
  RemoveQaPlanCaseDocument,
  SaveQaCaseDocument,
  SaveQaPlanDocument,
  SaveQaSuiteDocument,
  type RecordQaRunInput,
  type SaveQaCaseInput,
  type SaveQaPlanInput,
} from '@taskflow/sdk';
import type {
  QaCaseResponse,
  QaCoverageResponse,
  QaPlanCaseResponse,
  QaPlanResponse,
  QaReadinessResponse,
  QaRunResponse,
  QaSuiteResponse,
  RecordQaRunRequest,
  SaveQaCaseRequest,
  SaveQaPlanRequest,
} from '@taskflow/shared-types';
import { graphql } from '@/core/api/graphql-client';

/** E6.4 QA test management. Results come back in the shared-types shapes. */
export const qaApi = {
  suites: async (workspaceId: string, spaceId: string) => (await graphql(QaSuitesDocument, { workspaceId, spaceId })).qaSuites as QaSuiteResponse[],
  saveSuite: async (workspaceId: string, spaceId: string, suiteId: string | null, name: string) => (await graphql(SaveQaSuiteDocument, { workspaceId, spaceId, suiteId, name, description: null })).saveQaSuite as QaSuiteResponse,
  deleteSuite: async (workspaceId: string, suiteId: string) => (await graphql(DeleteQaSuiteDocument, { workspaceId, suiteId })).deleteQaSuite,
  cases: async (workspaceId: string, spaceId: string, filter: { suiteId?: string | null; search?: string | null }) =>
    (await graphql(QaCasesDocument, { workspaceId, spaceId, suiteId: filter.suiteId ?? null, status: null, search: filter.search ?? null })).qaCases as QaCaseResponse[],
  caseRuns: async (workspaceId: string, caseId: string) => (await graphql(QaCaseRunsDocument, { workspaceId, caseId })).qaCaseRuns as QaRunResponse[],
  saveCase: async (workspaceId: string, spaceId: string, caseId: string | null, input: SaveQaCaseRequest) =>
    (await graphql(SaveQaCaseDocument, { workspaceId, spaceId, caseId, input: input as SaveQaCaseInput })).saveQaCase as QaCaseResponse,
  deleteCase: async (workspaceId: string, caseId: string) => (await graphql(DeleteQaCaseDocument, { workspaceId, caseId })).deleteQaCase,
  plans: async (workspaceId: string, spaceId: string) => (await graphql(QaPlansDocument, { workspaceId, spaceId })).qaPlans as QaPlanResponse[],
  planCases: async (workspaceId: string, planId: string) => (await graphql(QaPlanCasesDocument, { workspaceId, planId })).qaPlanCases as QaPlanCaseResponse[],
  savePlan: async (workspaceId: string, spaceId: string, planId: string | null, input: SaveQaPlanRequest) =>
    (await graphql(SaveQaPlanDocument, { workspaceId, spaceId, planId, input: input as SaveQaPlanInput })).saveQaPlan as QaPlanResponse,
  deletePlan: async (workspaceId: string, planId: string) => (await graphql(DeleteQaPlanDocument, { workspaceId, planId })).deleteQaPlan,
  addCases: async (workspaceId: string, planId: string, input: { caseIds?: string[]; suiteId?: string | null; allReady?: boolean }) =>
    (await graphql(AddQaPlanCasesDocument, { workspaceId, planId, input })).addQaPlanCases,
  removeCase: async (workspaceId: string, planId: string, caseId: string) => (await graphql(RemoveQaPlanCaseDocument, { workspaceId, planId, caseId })).removeQaPlanCase,
  record: async (workspaceId: string, input: RecordQaRunRequest) => (await graphql(RecordQaRunDocument, { workspaceId, input: input as RecordQaRunInput })).recordQaRun as QaPlanCaseResponse,
  decide: async (workspaceId: string, planId: string, decision: 'approved' | 'rejected' | 'open', note: string | null) =>
    (await graphql(DecideQaPlanDocument, { workspaceId, planId, decision, note })).decideQaPlan as QaPlanResponse,
  readiness: async (workspaceId: string, planId: string) => (await graphql(QaReadinessDocument, { workspaceId, planId })).qaReadiness as QaReadinessResponse,
  coverage: async (workspaceId: string, spaceId: string) => (await graphql(QaCoverageDocument, { workspaceId, spaceId })).qaCoverage as QaCoverageResponse,
};
