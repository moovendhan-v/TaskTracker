import { describe, expect, it } from 'vitest';
import type { DocumentSummaryResponse } from '@taskflow/shared-types';
import { buildDocumentTree, pathTo } from './build-tree';

const doc = (id: string, parentId: string | null, position: number): DocumentSummaryResponse => ({
  id,
  parentId,
  spaceId: null,
  title: id,
  position,
  createdById: 'u',
  updatedAt: '2026-01-01T00:00:00.000Z',
});

const docs = [doc('b', null, 2), doc('a', null, 1), doc('a2', 'a', 2), doc('a1', 'a', 1), doc('orphan', 'missing', 1)];

describe('buildDocumentTree', () => {
  it('nests children and orders siblings by position', () => {
    const tree = buildDocumentTree(docs);
    expect(tree.map((n) => n.id)).toEqual(['a', 'orphan', 'b']);
    expect(tree[0]?.children.map((n) => n.id)).toEqual(['a1', 'a2']);
  });
});

describe('pathTo', () => {
  it('lists ancestors from the root down', () => expect(pathTo(docs, 'a2')).toEqual(['a', 'a2']));
});
