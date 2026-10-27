import type { IconKey } from '../domain/hierarchy.js';

export interface TaskListResponse {
  id: string;
  spaceId: string;
  /** The folder the list sits in; null when it sits directly under the space. */
  folderId: string | null;
  name: string;
  color: string | null;
  icon: IconKey | null;
  position: number;
  createdAt: string;
}

export interface CreateTaskListRequest {
  name: string;
  color?: string | null;
  icon?: IconKey | null;
  folderId?: string | null;
}

export interface UpdateTaskListRequest {
  name?: string;
  color?: string | null;
  icon?: IconKey | null;
}

/** Moves a list into a folder of the same space (or out of it, with null). */
export interface MoveTaskListRequest {
  folderId: string | null;
  position?: number;
}

export interface FolderResponse {
  id: string;
  spaceId: string;
  parentId: string | null;
  name: string;
  color: string | null;
  icon: IconKey | null;
  position: number;
  createdAt: string;
}

export interface CreateFolderRequest {
  name: string;
  color?: string | null;
  icon?: IconKey | null;
  parentId?: string | null;
}

export type UpdateFolderRequest = Partial<Omit<CreateFolderRequest, 'parentId'>>;

export interface MoveFolderRequest {
  parentId: string | null;
  position?: number;
}
