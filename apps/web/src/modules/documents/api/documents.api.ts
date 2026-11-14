import type { CreateDocumentRequest, MoveDocumentRequest, SaveDocTemplateRequest, UpdateDocumentRequest } from '@taskflow/shared-types';
import {
  CreateDocumentDocument,
  DeleteDocTemplateDocument,
  DeleteDocumentDocument,
  DocTemplatesDocument,
  DocumentDocument,
  DocumentsDocument,
  MoveDocumentDocument,
  SaveDocTemplateDocument,
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

/** Doc templates: the built-in starters, then the workspace's own. */
export const docTemplatesApi = {
  list: async (workspaceId: string) => (await graphql(DocTemplatesDocument, { workspaceId })).docTemplates,
  save: async (workspaceId: string, input: SaveDocTemplateRequest) => (await graphql(SaveDocTemplateDocument, { workspaceId, input })).saveDocTemplate,
  remove: async (workspaceId: string, templateId: string) => (await graphql(DeleteDocTemplateDocument, { workspaceId, templateId })).deleteDocTemplate,
};
