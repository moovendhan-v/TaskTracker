import type { SaveGithubConnectionRequest } from '@taskflow/shared-types';
import {
  ConnectGithubDocument,
  DismissInboxPullRequestDocument,
  DisconnectGithubDocument,
  GithubPullRequestInboxDocument,
  GithubSyncLogDocument,
  LinkInboxPullRequestDocument,
  GithubConnectionsDocument,
  RotateGithubSecretDocument,
  TaskPullRequestsDocument,
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
};
