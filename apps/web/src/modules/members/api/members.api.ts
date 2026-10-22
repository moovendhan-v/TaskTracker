import type { AddMemberRequest, UpdateMemberRoleRequest } from '@taskflow/shared-types';
import { AddMemberDocument, LeaveWorkspaceDocument, MembersDocument, RemoveMemberDocument, UpdateMemberRoleDocument } from '@taskflow/sdk';
import { graphql } from '@/core/api/graphql-client';

export const membersApi = {
  list: async (workspaceId: string) => (await graphql(MembersDocument, { workspaceId })).members,
  add: async (workspaceId: string, input: AddMemberRequest) => (await graphql(AddMemberDocument, { workspaceId, input })).addMember,
  updateRole: async (workspaceId: string, userId: string, { roleId }: UpdateMemberRoleRequest) =>
    (await graphql(UpdateMemberRoleDocument, { workspaceId, userId, roleId })).updateMemberRole,
  remove: async (workspaceId: string, userId: string) => (await graphql(RemoveMemberDocument, { workspaceId, userId })).removeMember,
  leave: async (workspaceId: string) => (await graphql(LeaveWorkspaceDocument, { workspaceId })).leaveWorkspace,
};
