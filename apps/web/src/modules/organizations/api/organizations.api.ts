import {
  AddOrganizationMemberDocument,
  AddWorkspaceToOrganizationDocument,
  CreateOrganizationDocument,
  DeleteOrganizationDocument,
  OrganizationActivityDocument,
  OrganizationDocument,
  OrganizationMembersDocument,
  OrganizationsDocument,
  OrganizationWorkspacesDocument,
  RemoveOrganizationMemberDocument,
  RemoveWorkspaceFromOrganizationDocument,
  RenameOrganizationDocument,
  SetOrganizationMemberRoleDocument,
  SetOrganizationTwoStepDocument,
  WorkspaceOrganizationDocument,
} from '@taskflow/sdk';
import { isOrgRole, isTwoStepRequirement, type OrgRole, type TwoStepRequirement } from '@taskflow/shared-types';
import { graphql } from '@/core/api/graphql-client';

/** Unknown values from a newer API read as the least privileged role and the strictest rule. */
const role = (value: string): OrgRole => (isOrgRole(value) ? value : 'member');
const twoStep = (value: string): TwoStepRequirement => (isTwoStepRequirement(value) ? value : 'everyone');
const toOrganization = <T extends { role: string; twoStepRequired: string }>(org: T) => ({ ...org, role: role(org.role), twoStepRequired: twoStep(org.twoStepRequired) });
const toMember = <T extends { role: string }>(member: T) => ({ ...member, role: role(member.role) });

export const organizationsApi = {
  list: async () => (await graphql(OrganizationsDocument, {})).organizations.map(toOrganization),
  get: async (organizationId: string) => toOrganization((await graphql(OrganizationDocument, { organizationId })).organization),
  members: async (organizationId: string) => (await graphql(OrganizationMembersDocument, { organizationId })).organizationMembers.map(toMember),
  workspaces: async (organizationId: string) => (await graphql(OrganizationWorkspacesDocument, { organizationId })).organizationWorkspaces,
  activity: async (organizationId: string) => (await graphql(OrganizationActivityDocument, { organizationId })).organizationActivity,
  ofWorkspace: async (workspaceId: string) => {
    const org = (await graphql(WorkspaceOrganizationDocument, { workspaceId })).workspaceOrganization;
    return org ? { ...org, twoStepRequired: twoStep(org.twoStepRequired) } : null;
  },
  create: async (name: string) => toOrganization((await graphql(CreateOrganizationDocument, { name })).createOrganization),
  rename: async (organizationId: string, name: string) => toOrganization((await graphql(RenameOrganizationDocument, { organizationId, name })).renameOrganization),
  setTwoStep: async (organizationId: string, require: TwoStepRequirement) =>
    toOrganization((await graphql(SetOrganizationTwoStepDocument, { organizationId, require })).setOrganizationTwoStep),
  remove: async (organizationId: string) => (await graphql(DeleteOrganizationDocument, { organizationId })).deleteOrganization,
  addMember: async (organizationId: string, email: string, memberRole: OrgRole) =>
    (await graphql(AddOrganizationMemberDocument, { organizationId, email, role: memberRole })).addOrganizationMember.map(toMember),
  setRole: async (organizationId: string, userId: string, memberRole: OrgRole) =>
    (await graphql(SetOrganizationMemberRoleDocument, { organizationId, userId, role: memberRole })).setOrganizationMemberRole.map(toMember),
  removeMember: async (organizationId: string, userId: string) =>
    (await graphql(RemoveOrganizationMemberDocument, { organizationId, userId })).removeOrganizationMember.map(toMember),
  attachWorkspace: async (workspaceId: string, organizationId: string) => (await graphql(AddWorkspaceToOrganizationDocument, { workspaceId, organizationId })).addWorkspaceToOrganization,
  detachWorkspace: async (workspaceId: string) => (await graphql(RemoveWorkspaceFromOrganizationDocument, { workspaceId })).removeWorkspaceFromOrganization,
};

export const organizationKeys = {
  all: ['organizations'] as const,
  one: (organizationId: string) => ['organizations', organizationId] as const,
  members: (organizationId: string) => ['organizations', organizationId, 'members'] as const,
  workspaces: (organizationId: string) => ['organizations', organizationId, 'workspaces'] as const,
  activity: (organizationId: string) => ['organizations', organizationId, 'activity'] as const,
  ofWorkspace: (workspaceId: string) => ['workspaces', workspaceId, 'organization'] as const,
};
