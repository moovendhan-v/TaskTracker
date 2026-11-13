import type { PullRequestState } from '@taskflow/shared-types';
import type { SaveGithubConnectionRequest } from '@taskflow/shared-types';
import {
  ConnectGithubDocument,
  ConnectGithubRepositoryDocument,
  CreateGithubIssueDocument,
  GithubAppDocument,
  GithubAppInstallUrlDocument,
  GithubInstallationRepositoriesDocument,
  GithubInstallationsDocument,
  GithubIssueRepositoriesDocument,
  RemoveGithubInstallationDocument,
  TaskGithubIssuesDocument,
  DismissInboxPullRequestDocument,
  DisconnectGithubDocument,
  GithubPullRequestInboxDocument,
  GithubSyncLogDocument,
  LinkInboxPullRequestDocument,
  GithubConnectionsDocument,
  RotateGithubSecretDocument,
  TaskPullRequestsDocument,
  GithubConflictsDocument,
  ResolveGithubConflictDocument,
  UpdateGithubConnectionDocument,
} from '@taskflow/sdk';
import { graphql } from '@/core/api/graphql-client';

export const integrationsApi = {
  githubConnections: async (workspaceId: string) => (await graphql(GithubConnectionsDocument, { workspaceId })).githubConnections,
  connectGithub: async (workspaceId: string, input: SaveGithubConnectionRequest) => (await graphql(ConnectGithubDocument, { workspaceId, input })).connectGithub,
  updateGithub: async (workspaceId: string, connectionId: string, input: Omit<SaveGithubConnectionRequest, 'repo'>) =>
    (await graphql(UpdateGithubConnectionDocument, { workspaceId, connectionId, input })).updateGithubConnection,
  rotateGithubSecret: async (workspaceId: string, connectionId: string) => (await graphql(RotateGithubSecretDocument, { workspaceId, connectionId })).rotateGithubSecret,
  disconnectGithub: async (workspaceId: string, connectionId: string) => (await graphql(DisconnectGithubDocument, { workspaceId, connectionId })).disconnectGithub,
  syncLog: async (workspaceId: string, connectionId: string) => (await graphql(GithubSyncLogDocument, { workspaceId, connectionId })).githubSyncLog,
  inbox: async (workspaceId: string) => (await graphql(GithubPullRequestInboxDocument, { workspaceId })).githubPullRequestInbox,
  linkInbox: async (workspaceId: string, itemId: string, taskNumber: number) => (await graphql(LinkInboxPullRequestDocument, { workspaceId, itemId, taskNumber })).linkInboxPullRequest,
  dismissInbox: async (workspaceId: string, itemId: string) => (await graphql(DismissInboxPullRequestDocument, { workspaceId, itemId })).dismissInboxPullRequest,
  taskPullRequests: async (workspaceId: string, taskId: string) => (await graphql(TaskPullRequestsDocument, { workspaceId, taskId })).taskPullRequests,
  /** GitHub moves left for a person: the task was changed in TaskFlow since sync last moved it. */
  conflicts: async (workspaceId: string, taskId: string) =>
    (await graphql(GithubConflictsDocument, { workspaceId, taskId })).githubConflicts.map((conflict) => ({ ...conflict, event: conflict.event as PullRequestState })),
  // ── The TaskFlow GitHub App (two-way sync) ──
  githubApp: async (workspaceId: string) => (await graphql(GithubAppDocument, { workspaceId })).githubApp,
  installUrl: async (workspaceId: string) => (await graphql(GithubAppInstallUrlDocument, { workspaceId })).githubAppInstallUrl,
  installations: async (workspaceId: string) => (await graphql(GithubInstallationsDocument, { workspaceId })).githubInstallations,
  installationRepositories: async (workspaceId: string, installationId: string) =>
    (await graphql(GithubInstallationRepositoriesDocument, { workspaceId, installationId })).githubInstallationRepositories,
  connectRepository: async (workspaceId: string, input: { installationId: string; repo: string; taskPrefix?: string }) =>
    (await graphql(ConnectGithubRepositoryDocument, { workspaceId, input })).connectGithubRepository,
  removeInstallation: async (workspaceId: string, installationId: string) => (await graphql(RemoveGithubInstallationDocument, { workspaceId, installationId })).removeGithubInstallation,
  issueRepositories: async (workspaceId: string) => (await graphql(GithubIssueRepositoriesDocument, { workspaceId })).githubIssueRepositories,
  taskIssues: async (workspaceId: string, taskId: string) => (await graphql(TaskGithubIssuesDocument, { workspaceId, taskId })).taskGithubIssues,
  createIssue: async (workspaceId: string, taskId: string, connectionId: string) => (await graphql(CreateGithubIssueDocument, { workspaceId, taskId, connectionId })).createGithubIssue,
  resolveConflict: async (workspaceId: string, conflictId: string, useGithub: boolean) => (await graphql(ResolveGithubConflictDocument, { workspaceId, conflictId, useGithub })).resolveGithubConflict,
};
