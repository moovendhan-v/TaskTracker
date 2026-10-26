import { describe, expect, it } from 'vitest';
import { DOC_MAX_DEPTH, type Permission } from '@taskflow/shared-types';
import { DocumentAccessPolicy } from './document-access.policy.js';
import { DocumentTreePolicy } from './document-tree.policy.js';

describe('DocumentTreePolicy', () => {
  it('keeps folders out of pages, but lets pages and folders go in folders', () => {
    expect(() => DocumentTreePolicy.assertValidPlacement({ kind: 'folder', parentKind: 'page', parentChain: ['a'], subtreeHeight: 1 })).toThrow(/folder/);
    expect(() => DocumentTreePolicy.assertValidPlacement({ kind: 'folder', parentKind: 'folder', parentChain: ['a'], subtreeHeight: 1 })).not.toThrow();
    expect(() => DocumentTreePolicy.assertValidPlacement({ kind: 'page', parentKind: 'folder', parentChain: ['a'], subtreeHeight: 1 })).not.toThrow();
  });

  it('allows top-level and nested placement within the depth limit', () => {
    expect(() => DocumentTreePolicy.assertValidPlacement({ kind: 'page', parentChain: [], subtreeHeight: 1 })).not.toThrow();
    expect(() => DocumentTreePolicy.assertValidPlacement({ kind: 'page', documentId: 'c', parentChain: ['b', 'a'], subtreeHeight: 2 })).not.toThrow();
  });

  it('blocks moving a page under itself or its descendants', () => {
    expect(() => DocumentTreePolicy.assertValidPlacement({ kind: 'page', documentId: 'a', parentChain: ['c', 'b', 'a'], subtreeHeight: 3 })).toThrow(
      /inside itself/,
    );
  });

  it('enforces the maximum depth, counting the moved subtree', () => {
    const chain = Array.from({ length: DOC_MAX_DEPTH - 1 }, (_, i) => `p${i}`);
    expect(() => DocumentTreePolicy.assertValidPlacement({ kind: 'page', parentChain: chain, subtreeHeight: 1 })).not.toThrow();
    expect(() => DocumentTreePolicy.assertValidPlacement({ kind: 'page', parentChain: chain, subtreeHeight: 2 })).toThrow(/levels deep/);
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
