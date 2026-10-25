import type { CreateSpaceRequest, CustomFieldEntity, UpdateSpaceRequest } from '@taskflow/shared-types';
import { CreateSpaceDocument, CustomFieldsDocument, DeleteSpaceDocument, SpacesDocument, UpdateSpaceDocument } from '@taskflow/sdk';
import { graphql } from '@/core/api/graphql-client';

export const spacesApi = {
  list: async (workspaceId: string) => (await graphql(SpacesDocument, { workspaceId })).spaces,
  create: async (workspaceId: string, input: CreateSpaceRequest) => (await graphql(CreateSpaceDocument, { workspaceId, input })).createSpace,
  update: async (workspaceId: string, spaceId: string, input: UpdateSpaceRequest) =>
    (await graphql(UpdateSpaceDocument, { workspaceId, spaceId, input })).updateSpace,
  customFields: async (workspaceId: string, entity: CustomFieldEntity) => (await graphql(CustomFieldsDocument, { workspaceId, entity })).customFields,
  remove: async (workspaceId: string, spaceId: string) => (await graphql(DeleteSpaceDocument, { workspaceId, spaceId })).deleteSpace,
};
