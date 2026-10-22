import type { DocumentSummaryResponse } from '@taskflow/shared-types';

export interface DocumentNode extends DocumentSummaryResponse {
  children: DocumentNode[];
}

/** Turns the flat page list into a tree, siblings ordered by position. Orphans (parent not loaded) become roots. */
export function buildDocumentTree(documents: readonly DocumentSummaryResponse[]): DocumentNode[] {
  const nodes = new Map<string, DocumentNode>(documents.map((doc) => [doc.id, { ...doc, children: [] }]));
  const roots: DocumentNode[] = [];
  for (const node of nodes.values()) {
    const parent = node.parentId ? nodes.get(node.parentId) : undefined;
    (parent ? parent.children : roots).push(node);
  }
  const sort = (list: DocumentNode[]) => {
    list.sort((a, b) => a.position - b.position || a.title.localeCompare(b.title));
    list.forEach((node) => sort(node.children));
  };
  sort(roots);
  return roots;
}

/** Ids from the root down to the page, for expanding the tree to show it. */
export function pathTo(documents: readonly DocumentSummaryResponse[], documentId: string): string[] {
  const byId = new Map(documents.map((doc) => [doc.id, doc]));
  const path: string[] = [];
  let current = byId.get(documentId);
  while (current && path.length < 50) {
    path.unshift(current.id);
    current = current.parentId ? byId.get(current.parentId) : undefined;
  }
  return path;
}
