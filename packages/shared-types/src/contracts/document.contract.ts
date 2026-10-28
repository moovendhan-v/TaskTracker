import type { DocKind } from '../domain/document.js';
import type { IconKey } from '../domain/hierarchy.js';

/** Tree node: everything except the content, so the sidebar loads fast. */
export interface DocumentSummaryResponse {
  id: string;
  parentId: string | null;
  spaceId: string | null;
  kind: DocKind;
  title: string;
  icon: IconKey | null;
  position: number;
  createdById: string;
  updatedAt: string;
}

export interface DocumentResponse extends DocumentSummaryResponse {
  /** Markdown. Clients must render it without raw HTML. */
  content: string;
  createdAt: string;
}

export interface CreateDocumentRequest {
  title: string;
  /** Defaults to a page. */
  kind?: DocKind;
  icon?: IconKey | null;
  content?: string;
  /** Nest under another page; the page inherits that parent's space. */
  parentId?: string | null;
  spaceId?: string | null;
}

export interface UpdateDocumentRequest {
  title?: string;
  icon?: IconKey | null;
  content?: string;
}

export interface MoveDocumentRequest {
  parentId: string | null;
  position?: number;
  /** For a top-level page: the space it belongs to (null takes it out of any). Ignored under a parent. */
  spaceId?: string | null;
}
