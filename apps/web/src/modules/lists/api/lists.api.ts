import type { CreateFolderRequest, CreateTaskListRequest, MoveFolderRequest, MoveTaskListRequest, UpdateFolderRequest, UpdateTaskListRequest } from '@taskflow/shared-types';
import {
  CreateFolderDocument,
  CreateListDocument,
  DeleteFolderDocument,
  DeleteListDocument,
  FoldersDocument,
  ListsDocument,
  MoveFolderDocument,
  MoveListDocument,
  UpdateFolderDocument,
  UpdateListDocument,
} from '@taskflow/sdk';
import { graphql } from '@/core/api/graphql-client';

export const listsApi = {
  list: async (workspaceId: string) => (await graphql(ListsDocument, { workspaceId })).lists,
  create: async (workspaceId: string, spaceId: string, input: CreateTaskListRequest) =>
    (await graphql(CreateListDocument, { workspaceId, spaceId, input })).createList,
  update: async (workspaceId: string, listId: string, input: UpdateTaskListRequest) =>
    (await graphql(UpdateListDocument, { workspaceId, listId, input })).updateList,
  move: async (workspaceId: string, listId: string, input: MoveTaskListRequest) => (await graphql(MoveListDocument, { workspaceId, listId, input })).moveList,
  remove: async (workspaceId: string, listId: string) => (await graphql(DeleteListDocument, { workspaceId, listId })).deleteList,
};

export const foldersApi = {
  list: async (workspaceId: string) => (await graphql(FoldersDocument, { workspaceId })).folders,
  create: async (workspaceId: string, spaceId: string, input: CreateFolderRequest) =>
    (await graphql(CreateFolderDocument, { workspaceId, spaceId, input })).createFolder,
  update: async (workspaceId: string, folderId: string, input: UpdateFolderRequest) =>
    (await graphql(UpdateFolderDocument, { workspaceId, folderId, input })).updateFolder,
  move: async (workspaceId: string, folderId: string, input: MoveFolderRequest) =>
    (await graphql(MoveFolderDocument, { workspaceId, folderId, input })).moveFolder,
  remove: async (workspaceId: string, folderId: string) => (await graphql(DeleteFolderDocument, { workspaceId, folderId })).deleteFolder,
};
