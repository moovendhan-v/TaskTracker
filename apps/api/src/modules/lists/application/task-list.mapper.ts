import type { FolderResponse, TaskListResponse } from '@taskflow/shared-types';
import type { ListFolder } from '../domain/list-folder.js';
import type { TaskList } from '../domain/task-list.js';

export const TaskListMapper = {
  toResponse(list: TaskList): TaskListResponse {
    return {
      id: list.id,
      spaceId: list.spaceId,
      folderId: list.folderId,
      name: list.name,
      color: list.color,
      icon: list.icon,
      position: list.position,
      createdAt: list.createdAt.toISOString(),
    };
  },

  toFolderResponse(folder: ListFolder): FolderResponse {
    return {
      id: folder.id,
      spaceId: folder.spaceId,
      parentId: folder.parentId,
      name: folder.name,
      color: folder.color,
      icon: folder.icon,
      position: folder.position,
      createdAt: folder.createdAt.toISOString(),
    };
  },
};
