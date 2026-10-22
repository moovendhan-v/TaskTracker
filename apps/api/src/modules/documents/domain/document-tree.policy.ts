import { DOC_MAX_DEPTH } from '@taskflow/shared-types';
import { DomainError } from '../../../core/domain/domain-error.js';

interface MoveCheck {
  /** The page being placed. Omit when creating a new page. */
  documentId?: string;
  /** Chain from the new parent up to the root: [parent, grandparent, …]. Empty for top level. */
  parentChain: readonly string[];
  /** Height of the subtree being placed (1 for a single page). */
  subtreeHeight: number;
}

/** Pages form a tree: no page may sit under itself, and nesting stops at DOC_MAX_DEPTH. */
export const DocumentTreePolicy = {
  assertValidPlacement({ documentId, parentChain, subtreeHeight }: MoveCheck): void {
    if (documentId && parentChain.includes(documentId)) {
      throw DomainError.invalid('A page can’t be moved inside itself');
    }
    const depth = parentChain.length + subtreeHeight;
    if (depth > DOC_MAX_DEPTH) throw DomainError.invalid(`Pages can be nested at most ${DOC_MAX_DEPTH} levels deep`);
  },
};
