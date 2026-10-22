import { describe, expect, it } from 'vitest';
import { DOC_MAX_DEPTH, type Permission } from '@taskflow/shared-types';
import { DocumentAccessPolicy } from './document-access.policy.js';
import { DocumentTreePolicy } from './document-tree.policy.js';

describe('DocumentTreePolicy', () => {
  it('allows top-level and nested placement within the depth limit', () => {
    expect(() => DocumentTreePolicy.assertValidPlacement({ parentChain: [], subtreeHeight: 1 })).not.toThrow();
    expect(() => DocumentTreePolicy.assertValidPlacement({ documentId: 'c', parentChain: ['b', 'a'], subtreeHeight: 2 })).not.toThrow();
  });

  it('blocks moving a page under itself or its descendants', () => {
    expect(() => DocumentTreePolicy.assertValidPlacement({ documentId: 'a', parentChain: ['c', 'b', 'a'], subtreeHeight: 3 })).toThrow(
      /inside itself/,
    );
  });

  it('enforces the maximum depth, counting the moved subtree', () => {
    const chain = Array.from({ length: DOC_MAX_DEPTH - 1 }, (_, i) => `p${i}`);
    expect(() => DocumentTreePolicy.assertValidPlacement({ parentChain: chain, subtreeHeight: 1 })).not.toThrow();
    expect(() => DocumentTreePolicy.assertValidPlacement({ parentChain: chain, subtreeHeight: 2 })).toThrow(/levels deep/);
  });
});

describe('DocumentAccessPolicy', () => {
  const doc = { createdById: 'author' };

  it('lets managers edit anything and creators edit their own pages', () => {
    expect(DocumentAccessPolicy.canEdit(doc, 'x', new Set<Permission>(['doc.manage']))).toBe(true);
    expect(DocumentAccessPolicy.canEdit(doc, 'author', new Set<Permission>(['doc.create']))).toBe(true);
    expect(DocumentAccessPolicy.canEdit(doc, 'x', new Set<Permission>(['doc.create']))).toBe(false);
    expect(() => DocumentAccessPolicy.assertCanEdit(doc, 'author', new Set<Permission>(['doc.view']))).toThrow();
  });
});
