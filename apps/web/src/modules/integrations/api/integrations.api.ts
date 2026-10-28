import type { SaveGithubConnectionRequest } from '@taskflow/shared-types';
import {
  ConnectGithubDocument,
  DisconnectGithubDocument,
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
  taskPullRequests: async (workspaceId: string, taskId: string) => (await graphql(TaskPullRequestsDocument, { workspaceId, taskId })).taskPullRequests,
};
