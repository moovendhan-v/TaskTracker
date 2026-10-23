import type { NewTaskList, TaskList } from './task-list.js';

export abstract class TaskListRepository {
  abstract listByWorkspace(workspaceId: string): Promise<TaskList[]>;
  abstract findInWorkspace(workspaceId: string, listId: string): Promise<TaskList | null>;
  abstract create(list: NewTaskList): Promise<TaskList>;
  abstract save(list: TaskList): Promise<TaskList>;
  abstract delete(workspaceId: string, listId: string): Promise<void>;
}
