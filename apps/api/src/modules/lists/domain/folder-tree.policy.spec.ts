import { describe, expect, it } from 'vitest';
import type { ListFolder } from './list-folder.js';
import { FolderTreePolicy } from './folder-tree.policy.js';

const folder = (id: string, parentId: string | null, spaceId = 's1'): ListFolder => ({
  id,
  workspaceId: 'w',
  spaceId,
  parentId,
  name: id,
  color: null,
  icon: null,
  position: 0,
  createdAt: new Date(),
  updatedAt: new Date(),
});

describe('FolderTreePolicy', () => {
  const a = folder('a', null);
  const b = folder('b', 'a');
  const c = folder('c', 'b');
  const folders = [a, b, c];

  it('allows a new folder under a folder with room', () => {
    expect(() => FolderTreePolicy.assertValidPlacement({ spaceId: 's1', parent: a, folders })).not.toThrow();
  });

  it('stops nesting past the maximum depth', () => {
    expect(() => FolderTreePolicy.assertValidPlacement({ spaceId: 's1', parent: c, folders })).toThrow(/at most 3 levels/);
  });

  it('refuses to move a folder inside itself or its own subtree', () => {
    expect(() => FolderTreePolicy.assertValidPlacement({ folderId: 'a', spaceId: 's1', parent: c, folders })).toThrow(/inside itself/);
  });

  it('counts the height of the subtree being moved', () => {
    const d = folder('d', null);
    expect(() => FolderTreePolicy.assertValidPlacement({ folderId: 'a', spaceId: 's1', parent: d, folders: [...folders, d] })).toThrow(/at most 3 levels/);
    expect(() => FolderTreePolicy.assertValidPlacement({ folderId: 'c', spaceId: 's1', parent: d, folders: [...folders, d] })).not.toThrow();
  });

  it('keeps folders inside one project', () => {
    expect(() => FolderTreePolicy.assertValidPlacement({ spaceId: 's2', parent: a, folders })).toThrow(/same project/);
  });
});
