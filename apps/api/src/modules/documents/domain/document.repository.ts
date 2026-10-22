import type { Document, DocumentSummary, NewDocument } from './document.js';

export abstract class DocumentRepository {
  /** Tree nodes without content, ordered for display. */
  abstract listSummaries(workspaceId: string, limit: number, search?: string): Promise<DocumentSummary[]>;
  abstract findInWorkspace(workspaceId: string, documentId: string): Promise<Document | null>;
  /** Ids from the page itself up to the root: [self, parent, grandparent, …]. */
  abstract ancestorChain(workspaceId: string, documentId: string): Promise<string[]>;
  /** Levels in the subtree rooted at this page (1 for a page with no children). */
  abstract subtreeHeight(workspaceId: string, documentId: string): Promise<number>;
  abstract maxSiblingPosition(workspaceId: string, parentId: string | null): Promise<number>;
  abstract create(document: NewDocument): Promise<Document>;
  abstract save(document: Document): Promise<Document>;
  /** Child pages go with it (ON DELETE CASCADE). */
  abstract delete(workspaceId: string, documentId: string): Promise<void>;
}
