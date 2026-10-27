import { describe, expect, it } from 'vitest';
import type { DocKind, DocumentSummaryResponse } from '@taskflow/shared-types';
import { placementFor, zoneAt } from './drop-target';

const doc = (id: string, parentId: string | null, position: number, kind: DocKind = 'page'): DocumentSummaryResponse => ({
  id,
  parentId,
  spaceId: null,
  icon: null,
  kind,
  title: id,
  position,
  createdById: 'u',
  updatedAt: '2026-01-01T00:00:00.000Z',
});

// specs/ (folder) > api, ui ; notes (page) > draft ; archive/ (folder)
const docs = [
  doc('specs', null, 1024, 'folder'),
  doc('api', 'specs', 1024),
  doc('ui', 'specs', 2048),
  doc('notes', null, 2048),
  doc('draft', 'notes', 1024),
  doc('archive', null, 3072, 'folder'),
];

describe('zoneAt', () => {
  it('splits a row into before, inside and after', () => {
    expect(zoneAt(2, 32)).toBe('before');
    expect(zoneAt(16, 32)).toBe('inside');
    expect(zoneAt(30, 32)).toBe('after');
  });
});

describe('placementFor', () => {
  it('drops into a folder after its last child', () => {
    expect(placementFor(docs, 'notes', 'specs', 'inside')).toEqual({ parentId: 'specs', position: 3072 });
    expect(placementFor(docs, 'specs', 'archive', 'inside')).toEqual({ parentId: 'archive', position: 1024 });
  });

  it('places between siblings when dropped above or below a row', () => {
    expect(placementFor(docs, 'draft', 'ui', 'before')).toEqual({ parentId: 'specs', position: 1536 });
    expect(placementFor(docs, 'draft', 'ui', 'after')).toEqual({ parentId: 'specs', position: 3072 });
    expect(placementFor(docs, 'api', 'specs', 'before')).toEqual({ parentId: null, position: 0 });
  });

  it('moves to the top level when dropped below the tree', () => {
    expect(placementFor(docs, 'api', null, 'after')).toEqual({ parentId: null, position: 4096 });
  });

  it('refuses drops onto itself, into its own sub-pages, or a folder into a page', () => {
    expect(placementFor(docs, 'specs', 'specs', 'inside')).toBeNull();
    expect(placementFor(docs, 'specs', 'api', 'after')).toBeNull();
    expect(placementFor(docs, 'archive', 'notes', 'inside')).toBeNull();
    expect(placementFor(docs, 'archive', 'draft', 'after')).toBeNull();
  });
});
