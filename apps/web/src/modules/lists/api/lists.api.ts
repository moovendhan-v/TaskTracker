import type { CreateTaskListRequest, UpdateTaskListRequest } from '@taskflow/shared-types';
import { CreateListDocument, DeleteListDocument, ListsDocument, UpdateListDocument } from '@taskflow/sdk';
import { graphql } from '@/core/api/graphql-client';

export const listsApi = {
  list: async (workspaceId: string) => (await graphql(ListsDocument, { workspaceId })).lists,
  create: async (workspaceId: string, spaceId: string, input: CreateTaskListRequest) =>
    (await graphql(CreateListDocument, { workspaceId, spaceId, input })).createList,
  update: async (workspaceId: string, listId: string, input: UpdateTaskListRequest) =>
    (await graphql(UpdateListDocument, { workspaceId, listId, input })).updateList,
  remove: async (workspaceId: string, listId: string) => (await graphql(DeleteListDocument, { workspaceId, listId })).deleteList,
};
