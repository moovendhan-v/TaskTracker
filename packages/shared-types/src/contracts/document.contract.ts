/** Tree node: everything except the content, so the sidebar loads fast. */
export interface DocumentSummaryResponse {
  id: string;
  parentId: string | null;
  spaceId: string | null;
  title: string;
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
  content?: string;
  /** Nest under another page; the page inherits that parent's space. */
  parentId?: string | null;
  spaceId?: string | null;
}

export interface UpdateDocumentRequest {
  title?: string;
  content?: string;
}

export interface MoveDocumentRequest {
  parentId: string | null;
  position?: number;
}
