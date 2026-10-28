import type { IconKey } from '@taskflow/shared-types';

export interface TaskList {
  id: string;
  workspaceId: string;
  spaceId: string;
  /** Null: directly under the space. */
  folderId: string | null;
  name: string;
  color: string | null;
  icon: IconKey | null;
  position: number;
  createdAt: Date;
  updatedAt: Date;
}

export type NewTaskList = Pick<TaskList, 'workspaceId' | 'spaceId' | 'name'> & Partial<Pick<TaskList, 'folderId' | 'color' | 'icon' | 'position'>>;
