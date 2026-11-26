import { BugCaptureDocument, BugDocument, BugsDocument, MarkBugDuplicateDocument, ReportBugDocument, SetBugQaStateDocument, SimilarBugsDocument, UpdateBugDocument, type ReportBugInput, type UpdateBugInput as UpdateBugInputSdk } from '@taskflow/sdk';
import type { BugCaptureResponse, BugFilter, BugQaState, BugResponse, SimilarBugResponse, UpdateBugRequest } from '@taskflow/shared-types';
import { graphql } from '@/core/api/graphql-client';

const asBug = (bug: unknown) => bug as BugResponse;

export const bugsApi = {
  list: async (workspaceId: string, spaceId: string, filter: BugFilter): Promise<BugResponse[]> => (await graphql(BugsDocument, { workspaceId, spaceId, filter })).bugs.map(asBug),
  get: async (workspaceId: string, taskId: string): Promise<BugResponse> => asBug((await graphql(BugDocument, { workspaceId, taskId })).bug),
  capture: async (workspaceId: string, taskId: string): Promise<BugCaptureResponse> => JSON.parse((await graphql(BugCaptureDocument, { workspaceId, taskId })).bugCapture) as BugCaptureResponse,
  similar: async (workspaceId: string, spaceId: string, title: string, excludeTaskId: string | null): Promise<SimilarBugResponse[]> =>
    (await graphql(SimilarBugsDocument, { workspaceId, spaceId, title, excludeTaskId })).similarBugs as SimilarBugResponse[],
  report: async (workspaceId: string, input: ReportBugInput): Promise<BugResponse> => asBug((await graphql(ReportBugDocument, { workspaceId, input })).reportBug),
  update: async (workspaceId: string, taskId: string, input: UpdateBugRequest): Promise<BugResponse> => asBug((await graphql(UpdateBugDocument, { workspaceId, taskId, input: input as UpdateBugInputSdk })).updateBug),
  setQaState: async (workspaceId: string, taskId: string, state: BugQaState): Promise<BugResponse> => asBug((await graphql(SetBugQaStateDocument, { workspaceId, taskId, state })).setBugQaState),
  markDuplicate: async (workspaceId: string, taskId: string, ofTaskId: string): Promise<BugResponse> => asBug((await graphql(MarkBugDuplicateDocument, { workspaceId, taskId, ofTaskId })).markBugDuplicate),
};
