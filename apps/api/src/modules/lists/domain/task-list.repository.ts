import type { NewTaskList, TaskList } from './task-list.js';

export abstract class TaskListRepository {
  abstract listByWorkspace(workspaceId: string): Promise<TaskList[]>;
  abstract findInWorkspace(workspaceId: string, listId: string): Promise<TaskList | null>;
  /** The space's first list, if it has any. */
  abstract firstInSpace(workspaceId: string, spaceId: string): Promise<TaskList | null>;
  /** Highest position among the lists in one folder (or directly under the space), 0 when empty. */
  abstract maxPosition(workspaceId: string, spaceId: string, folderId: string | null): Promise<number>;
  /** Moves every list in a folder to another folder (or to the space with null). */
  abstract moveAllFromFolder(workspaceId: string, folderId: string, target: string | null): Promise<void>;
  abstract create(list: NewTaskList): Promise<TaskList>;
  abstract save(list: TaskList): Promise<TaskList>;
  abstract delete(workspaceId: string, listId: string): Promise<void>;
}
