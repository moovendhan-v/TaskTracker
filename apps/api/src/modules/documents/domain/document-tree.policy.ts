import { DOC_MAX_DEPTH, type DocKind } from '@taskflow/shared-types';
import { DomainError } from '../../../core/domain/domain-error.js';

interface MoveCheck {
  kind: DocKind;
  /** Kind of the new parent; undefined for top level. */
  parentKind?: DocKind;
  /** The page being placed. Omit when creating a new page. */
  documentId?: string;
  /** Chain from the new parent up to the root: [parent, grandparent, …]. Empty for top level. */
  parentChain: readonly string[];
  /** Height of the subtree being placed (1 for a single page). */
  subtreeHeight: number;
}

/**
 * Pages and folders form a tree: nothing may sit under itself, a folder sits
 * only at the top level or in another folder, and nesting stops at DOC_MAX_DEPTH.
 */
export const DocumentTreePolicy = {
  assertValidPlacement({ kind, parentKind, documentId, parentChain, subtreeHeight }: MoveCheck): void {
    if (kind === 'folder' && parentKind === 'page') throw DomainError.invalid('A folder can only go inside another folder');
    if (documentId && parentChain.includes(documentId)) {
      throw DomainError.invalid('A page can’t be moved inside itself');
    }
    const depth = parentChain.length + subtreeHeight;
    if (depth > DOC_MAX_DEPTH) throw DomainError.invalid(`Pages can be nested at most ${DOC_MAX_DEPTH} levels deep`);
  },
};
