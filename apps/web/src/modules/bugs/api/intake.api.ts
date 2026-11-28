import { BugIntakeDocument, BugSharesDocument, CreateBugShareDocument, RevokeBugShareDocument, RotateBugIntakeKeyDocument, SaveBugIntakeDocument } from '@taskflow/sdk';
import type { BugIntakeResponse, BugShareResponse, CreatedBugShare, PublicBugView, PublicIntakeConfig, PublicReportRequest, PublicReportResponse, SaveBugIntakeRequest } from '@taskflow/shared-types';
import { graphql } from '@/core/api/graphql-client';

/** A project's public feedback settings and read-only report links (members). */
export const intakeApi = {
  get: async (workspaceId: string, spaceId: string): Promise<BugIntakeResponse | null> => (await graphql(BugIntakeDocument, { workspaceId, spaceId })).bugIntake ?? null,
  save: async (workspaceId: string, spaceId: string, input: SaveBugIntakeRequest): Promise<BugIntakeResponse> => (await graphql(SaveBugIntakeDocument, { workspaceId, spaceId, input })).saveBugIntake,
  rotate: async (workspaceId: string, spaceId: string): Promise<BugIntakeResponse> => (await graphql(RotateBugIntakeKeyDocument, { workspaceId, spaceId })).rotateBugIntakeKey,
  shares: async (workspaceId: string, taskId: string): Promise<BugShareResponse[]> => (await graphql(BugSharesDocument, { workspaceId, taskId })).bugShares as BugShareResponse[],
  share: async (workspaceId: string, taskId: string, days: number): Promise<CreatedBugShare> => (await graphql(CreateBugShareDocument, { workspaceId, taskId, days })).createBugShare as CreatedBugShare,
  revokeShare: async (workspaceId: string, shareId: string): Promise<boolean> => (await graphql(RevokeBugShareDocument, { workspaceId, shareId })).revokeBugShare,
};

async function publicCall<T>(path: string, body?: unknown): Promise<T> {
  const response = await fetch(`/api/public/${path}`, {
    method: body === undefined ? 'GET' : 'POST',
    credentials: 'omit',
    headers: { 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const data = (await response.json().catch(() => ({}))) as T & { message?: string };
  if (!response.ok) throw new Error(response.status === 404 ? 'not-found' : (data.message ?? 'Something went wrong. Try again.'));
  return data;
}

/** The public side: the feedback portal and read-only links, with nobody signed in. */
export const publicFeedbackApi = {
  config: (key: string) => publicCall<PublicIntakeConfig>(`intake/${encodeURIComponent(key)}`),
  report: (key: string, body: PublicReportRequest) => publicCall<PublicReportResponse>(`intake/${encodeURIComponent(key)}/reports`, body),
  view: (token: string) => publicCall<PublicBugView>(`shares/${encodeURIComponent(token)}`),
};
