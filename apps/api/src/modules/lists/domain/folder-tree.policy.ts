import { FOLDER_MAX_DEPTH, FOLDERS_PER_SPACE_MAX } from '@taskflow/shared-types';
import { DomainError } from '../../../core/domain/domain-error.js';
import type { ListFolder } from './list-folder.js';

/**
 * Folders form a tree inside one space: nothing sits under itself, a folder
 * and its parent share a space, and nesting stops at FOLDER_MAX_DEPTH.
 */
export const FolderTreePolicy = {
  /** Ancestors of a folder, nearest first: [parent, grandparent, …]. */
  chain(folderId: string | null, byId: ReadonlyMap<string, ListFolder>): string[] {
    const chain: string[] = [];
    let current = folderId ? byId.get(folderId) : undefined;
    while (current && chain.length <= FOLDER_MAX_DEPTH + 1) {
      chain.push(current.id);
      current = current.parentId ? byId.get(current.parentId) : undefined;
    }
    return chain;
  },

  /** Levels in the subtree under (and including) a folder. */
  height(folderId: string, folders: readonly ListFolder[]): number {
    const children = folders.filter((folder) => folder.parentId === folderId);
    return 1 + Math.max(0, ...children.map((child) => FolderTreePolicy.height(child.id, folders)));
  },

  assertValidPlacement(input: { folderId?: string; spaceId: string; parent: ListFolder | null; folders: readonly ListFolder[] }): void {
    const { folderId, spaceId, parent, folders } = input;
    if (parent && parent.spaceId !== spaceId) throw DomainError.invalid('A folder can only go inside a folder of the same project');
    const byId = new Map(folders.map((folder) => [folder.id, folder]));
    const chain = FolderTreePolicy.chain(parent?.id ?? null, byId);
    if (folderId && chain.includes(folderId)) throw DomainError.invalid('A folder can’t be moved inside itself');
    const height = folderId ? FolderTreePolicy.height(folderId, folders) : 1;
    if (chain.length + height > FOLDER_MAX_DEPTH) throw DomainError.invalid(`Folders can be nested at most ${FOLDER_MAX_DEPTH} levels deep`);
  },

  assertRoomFor(folderCount: number): void {
    if (folderCount >= FOLDERS_PER_SPACE_MAX) throw DomainError.invalid(`A project can have at most ${FOLDERS_PER_SPACE_MAX} folders`);
  },
};
