import type { CreateDocumentRequest, MoveDocumentRequest, UpdateDocumentRequest } from '@taskflow/shared-types';
import { unwrap } from '@taskflow/sdk';
import { api } from '@/core/api/sdk-client';

type DocPath = { workspaceId: string; documentId: string };

export const documentsApi = {
  tree: (workspaceId: string, search?: string) =>
    unwrap(api.GET('/api/workspaces/{workspaceId}/documents', { params: { path: { workspaceId }, query: search ? { search } : {} } })),
  get: (path: DocPath) => unwrap(api.GET('/api/workspaces/{workspaceId}/documents/{documentId}', { params: { path } })),
  create: (workspaceId: string, body: CreateDocumentRequest) =>
    unwrap(api.POST('/api/workspaces/{workspaceId}/documents', { params: { path: { workspaceId } }, body })),
  update: (path: DocPath, body: UpdateDocumentRequest) =>
    unwrap(api.PATCH('/api/workspaces/{workspaceId}/documents/{documentId}', { params: { path }, body })),
  move: (path: DocPath, body: MoveDocumentRequest) =>
    unwrap(api.POST('/api/workspaces/{workspaceId}/documents/{documentId}/move', { params: { path }, body })),
  remove: (path: DocPath) => unwrap(api.DELETE('/api/workspaces/{workspaceId}/documents/{documentId}', { params: { path } })),
};
