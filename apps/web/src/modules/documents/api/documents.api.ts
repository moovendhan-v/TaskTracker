import type { CreateDocumentRequest, MoveDocumentRequest, UpdateDocumentRequest } from '@taskflow/shared-types';
import {
  CreateDocumentDocument,
  DeleteDocumentDocument,
  DocumentDocument,
  DocumentsDocument,
  MoveDocumentDocument,
  UpdateDocumentDocument,
} from '@taskflow/sdk';
import { graphql } from '@/core/api/graphql-client';

type DocPath = { workspaceId: string; documentId: string };

export const documentsApi = {
  tree: async (workspaceId: string, search?: string) =>
    (await graphql(DocumentsDocument, { workspaceId, search: search || undefined })).documents,
  get: async (path: DocPath) => (await graphql(DocumentDocument, path)).document,
  create: async (workspaceId: string, input: CreateDocumentRequest) =>
    (await graphql(CreateDocumentDocument, { workspaceId, input })).createDocument,
  update: async (path: DocPath, input: UpdateDocumentRequest) => (await graphql(UpdateDocumentDocument, { ...path, input })).updateDocument,
  move: async (path: DocPath, move: MoveDocumentRequest) => (await graphql(MoveDocumentDocument, { ...path, ...move })).moveDocument,
  remove: async (path: DocPath) => (await graphql(DeleteDocumentDocument, path)).deleteDocument,
};
