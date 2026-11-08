import { isTwoStepRequirement, parsePermissions, parseSpaceRules, type CreateWorkspaceRequest, type TwoStepRequirement, type UpdateWorkspaceRequest } from '@taskflow/shared-types';
import {
  CreateWorkspaceDocument,
  DeleteWorkspaceDocument,
  SetTwoStepRequirementDocument,
  TwoStepPolicyDocument,
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

/** An unknown value from a newer API reads as the strictest one, so the UI never understates it. */
const toTwoStep = (policy: { require: string; callerHasTwoStep: boolean }) => ({
  require: (isTwoStepRequirement(policy.require) ? policy.require : 'everyone') as TwoStepRequirement,
  callerHasTwoStep: policy.callerHasTwoStep,
});

export const workspacesApi = {
  list: async () => (await graphql(WorkspacesDocument, {})).workspaces.map(toWorkspace),
  get: async (workspaceId: string) => toWorkspace((await graphql(WorkspaceDocument, { workspaceId })).workspace),
  create: async (input: CreateWorkspaceRequest) => toWorkspace((await graphql(CreateWorkspaceDocument, { input })).createWorkspace),
  update: async (workspaceId: string, input: UpdateWorkspaceRequest) =>
    toWorkspace((await graphql(UpdateWorkspaceDocument, { workspaceId, input })).updateWorkspace),
  twoStepPolicy: async (workspaceId: string) => toTwoStep((await graphql(TwoStepPolicyDocument, { workspaceId })).twoStepPolicy),
  setTwoStep: async (workspaceId: string, require: TwoStepRequirement) => toTwoStep((await graphql(SetTwoStepRequirementDocument, { workspaceId, require })).setTwoStepRequirement),
  remove: async (workspaceId: string) => (await graphql(DeleteWorkspaceDocument, { workspaceId })).deleteWorkspace,
};
