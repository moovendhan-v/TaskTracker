import type { DocumentSummaryResponse } from '@taskflow/shared-types';

/** Where on a row the pointer is: the top quarter, the middle or the bottom quarter. */
export type DropZone = 'before' | 'inside' | 'after';

export interface Placement {
  parentId: string | null;
  position: number;
}

const STEP = 1024;

/** The zone for a pointer `offsetY` pixels into a row of `height` pixels. */
export function zoneAt(offsetY: number, height: number): DropZone {
  if (offsetY < height * 0.25) return 'before';
  if (offsetY > height * 0.75) return 'after';
  return 'inside';
}

/** True when `id` is `ancestorId` or sits somewhere below it. */
function isWithin(byId: Map<string, DocumentSummaryResponse>, id: string, ancestorId: string): boolean {
  let current = byId.get(id);
  for (let hops = 0; current && hops < 50; hops += 1) {
    if (current.id === ancestorId) return true;
    current = current.parentId ? byId.get(current.parentId) : undefined;
  }
  return false;
}

function siblingsOf(documents: readonly DocumentSummaryResponse[], parentId: string | null, exceptId: string) {
  return documents.filter((doc) => doc.parentId === parentId && doc.id !== exceptId).sort((a, b) => a.position - b.position);
}

/**
 * Where a dragged page or folder lands when dropped on `targetId` (or on the
 * empty area below the tree when `targetId` is null), or null when the drop
 * isn't allowed: onto itself or its own sub-pages, or a folder into a page.
 * The API checks the same rules.
 */
export function placementFor(documents: readonly DocumentSummaryResponse[], draggedId: string, targetId: string | null, zone: DropZone): Placement | null {
  const byId = new Map(documents.map((doc) => [doc.id, doc]));
  const dragged = byId.get(draggedId);
  if (!dragged) return null;

  if (targetId === null) {
    const roots = siblingsOf(documents, null, draggedId);
    return { parentId: null, position: (roots.at(-1)?.position ?? 0) + STEP };
  }

  const target = byId.get(targetId);
  if (!target || isWithin(byId, targetId, draggedId)) return null;

  if (zone === 'inside') {
    if (dragged.kind === 'folder' && target.kind !== 'folder') return null;
    const children = siblingsOf(documents, target.id, draggedId);
    return { parentId: target.id, position: (children.at(-1)?.position ?? 0) + STEP };
  }

  const parentId = target.parentId;
  const parent = parentId ? byId.get(parentId) : undefined;
  if (dragged.kind === 'folder' && parent && parent.kind !== 'folder') return null;
  const siblings = siblingsOf(documents, parentId, draggedId);
  const index = siblings.findIndex((doc) => doc.id === target.id);
  const before = zone === 'before' ? siblings[index - 1] : target;
  const after = zone === 'before' ? target : siblings[index + 1];
  const position =
    before && after ? (before.position + after.position) / 2 : before ? before.position + STEP : after ? after.position - STEP : STEP;
  return { parentId, position };
}
