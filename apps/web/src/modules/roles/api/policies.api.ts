import type { PolicyDocument, SavePolicyRequest } from '@taskflow/shared-types';
import {
  AttachRolePolicyDocument,
  CreatePolicyDocument,
  DeletePolicyDocument,
  DetachRolePolicyDocument,
  PoliciesDocument,
  ProtectedFieldsDocument,
  SetRoleInlinePolicyDocument,
  UpdatePolicyDocument,
} from '@taskflow/sdk';
import { graphql } from '@/core/api/graphql-client';

/** Strips nulls the API sends for unused statement parts, so documents round-trip as inputs. */
export function toDocumentInput(document: PolicyDocument): PolicyDocument {
  return {
    statements: document.statements.map((statement) => ({
      effect: statement.effect,
      ...(statement.permissions?.length ? { permissions: statement.permissions } : {}),
      ...(statement.fields?.length ? { fields: statement.fields } : {}),
      ...(statement.spaces?.length ? { spaces: statement.spaces } : {}),
      ...(statement.notSpaces?.length ? { notSpaces: statement.notSpaces } : {}),
    })),
  };
}

export const policiesApi = {
  list: async (workspaceId: string) => (await graphql(PoliciesDocument, { workspaceId })).policies,
  fields: async (workspaceId: string) => (await graphql(ProtectedFieldsDocument, { workspaceId })).protectedFields,
  create: async (workspaceId: string, input: SavePolicyRequest) =>
    (await graphql(CreatePolicyDocument, { workspaceId, input: { ...input, document: toDocumentInput(input.document) } })).createPolicy,
  update: async (workspaceId: string, policyId: string, input: SavePolicyRequest) =>
    (await graphql(UpdatePolicyDocument, { workspaceId, policyId, input: { ...input, document: toDocumentInput(input.document) } })).updatePolicy,
  remove: async (workspaceId: string, policyId: string) => (await graphql(DeletePolicyDocument, { workspaceId, policyId })).deletePolicy,
  attach: async (workspaceId: string, roleId: string, policy: string) => (await graphql(AttachRolePolicyDocument, { workspaceId, roleId, policy })).attachRolePolicy,
  detach: async (workspaceId: string, roleId: string, policy: string) => (await graphql(DetachRolePolicyDocument, { workspaceId, roleId, policy })).detachRolePolicy,
  setInline: async (workspaceId: string, roleId: string, document: PolicyDocument) =>
    (await graphql(SetRoleInlinePolicyDocument, { workspaceId, roleId, document: toDocumentInput(document) })).setRoleInlinePolicy,
};
