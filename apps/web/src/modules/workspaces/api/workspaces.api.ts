import { parsePermissions, parseSpaceRules, type CreateWorkspaceRequest, type UpdateWorkspaceRequest } from '@taskflow/shared-types';
import {
  CreateWorkspaceDocument,
  DeleteWorkspaceDocument,
  UpdateWorkspaceDocument,
  WorkspaceDocument,
  WorkspacesDocument,
  type WorkspaceFieldsFragment,
} from '@taskflow/sdk';
import { graphql } from '@/core/api/graphql-client';

/** Permission keys arrive as strings; unknown keys are dropped rather than trusted. */
const toWorkspace = (workspace: WorkspaceFieldsFragment) => ({
  ...workspace,
  permissions: parsePermissions(workspace.permissions),
  spaceRules: parseSpaceRules(workspace.spaceRules),
});

export const workspacesApi = {
  list: async () => (await graphql(WorkspacesDocument, {})).workspaces.map(toWorkspace),
  get: async (workspaceId: string) => toWorkspace((await graphql(WorkspaceDocument, { workspaceId })).workspace),
  create: async (input: CreateWorkspaceRequest) => toWorkspace((await graphql(CreateWorkspaceDocument, { input })).createWorkspace),
  update: async (workspaceId: string, input: UpdateWorkspaceRequest) =>
    toWorkspace((await graphql(UpdateWorkspaceDocument, { workspaceId, input })).updateWorkspace),
  remove: async (workspaceId: string) => (await graphql(DeleteWorkspaceDocument, { workspaceId })).deleteWorkspace,
};
