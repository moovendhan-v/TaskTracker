import type { IconKey } from '@taskflow/shared-types';

/** Groups a space's lists; folders can hold other folders (see FolderTreePolicy). */
export interface ListFolder {
  id: string;
  workspaceId: string;
  spaceId: string;
  parentId: string | null;
  name: string;
  color: string | null;
  icon: IconKey | null;
  position: number;
  createdAt: Date;
  updatedAt: Date;
}

export type NewListFolder = Pick<ListFolder, 'workspaceId' | 'spaceId' | 'parentId' | 'name' | 'color' | 'icon' | 'position'>;
