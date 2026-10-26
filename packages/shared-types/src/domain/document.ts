export const DOC_TITLE_MAX = 200;
export const DOC_CONTENT_MAX = 100_000;
/** Deepest a page can sit in the tree (a top-level page is depth 1). */
export const DOC_MAX_DEPTH = 8;
/** A folder only holds other pages and folders; a page has content (and may hold sub-pages). */
export const DOC_KINDS = ['page', 'folder'] as const;
export type DocKind = (typeof DOC_KINDS)[number];
/** Most pages returned for the tree in one call. */
export const DOC_TREE_LIMIT = 500;
