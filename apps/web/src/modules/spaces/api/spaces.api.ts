import type { CreateSpaceRequest, CustomFieldEntity, SaveCustomFieldRequest, SaveTaskStatusRequest, UpdateSpaceRequest } from '@taskflow/shared-types';
import {
  CreateCustomFieldDocument,
  CreateSpaceDocument,
  CreateStatusDocument,
  CustomFieldsDocument,
  DeleteCustomFieldDocument,
  DeleteSpaceDocument,
  DeleteStatusDocument,
  ReorderStatusesDocument,
  SpacesDocument,
  UpdateCustomFieldDocument,
  UpdateSpaceDocument,
  UpdateStatusDocument,
} from '@taskflow/sdk';
import { graphql } from '@/core/api/graphql-client';

export const spacesApi = {
  list: async (workspaceId: string) => (await graphql(SpacesDocument, { workspaceId })).spaces,
  create: async (workspaceId: string, input: CreateSpaceRequest) => (await graphql(CreateSpaceDocument, { workspaceId, input })).createSpace,
  update: async (workspaceId: string, spaceId: string, input: UpdateSpaceRequest) =>
    (await graphql(UpdateSpaceDocument, { workspaceId, spaceId, input })).updateSpace,
  customFields: async (workspaceId: string, entity: CustomFieldEntity) => (await graphql(CustomFieldsDocument, { workspaceId, entity })).customFields,
  remove: async (workspaceId: string, spaceId: string) => (await graphql(DeleteSpaceDocument, { workspaceId, spaceId })).deleteSpace,
};

/** A space's own statuses: what tasks move through, and what each one means. */
export const statusesApi = {
  create: async (workspaceId: string, spaceId: string, input: SaveTaskStatusRequest) =>
    (await graphql(CreateStatusDocument, { workspaceId, spaceId, input })).createStatus,
  update: async (workspaceId: string, statusId: string, input: Partial<SaveTaskStatusRequest>) =>
    (await graphql(UpdateStatusDocument, { workspaceId, statusId, input })).updateStatus,
  remove: async (workspaceId: string, statusId: string, moveTasksTo: string) => (await graphql(DeleteStatusDocument, { workspaceId, statusId, moveTasksTo })).deleteStatus,
  reorder: async (workspaceId: string, spaceId: string, statusIds: string[]) =>
    (await graphql(ReorderStatusesDocument, { workspaceId, spaceId, statusIds })).reorderStatuses,
};

export const customFieldsApi = {
  create: async (workspaceId: string, input: SaveCustomFieldRequest) => (await graphql(CreateCustomFieldDocument, { workspaceId, input })).createCustomField,
  update: async (workspaceId: string, fieldId: string, input: Pick<SaveCustomFieldRequest, 'name' | 'options' | 'required'>) =>
    (await graphql(UpdateCustomFieldDocument, { workspaceId, fieldId, input })).updateCustomField,
  remove: async (workspaceId: string, fieldId: string) => (await graphql(DeleteCustomFieldDocument, { workspaceId, fieldId })).deleteCustomField,
};
