import type { DocumentResponse, DocumentSummaryResponse } from '@taskflow/shared-types';
import type { Document, DocumentSummary } from '../domain/document.js';

export const DocumentMapper = {
  toSummary(document: DocumentSummary): DocumentSummaryResponse {
    return {
      id: document.id,
      parentId: document.parentId,
      spaceId: document.spaceId,
      title: document.title,
      position: document.position,
      createdById: document.createdById,
      updatedAt: document.updatedAt.toISOString(),
    };
  },

  toResponse(document: Document): DocumentResponse {
    return { ...DocumentMapper.toSummary(document), content: document.content, createdAt: document.createdAt.toISOString() };
  },
};
