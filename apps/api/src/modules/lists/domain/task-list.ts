export interface TaskList {
  id: string;
  workspaceId: string;
  spaceId: string;
  name: string;
  createdAt: Date;
  updatedAt: Date;
}

export type NewTaskList = Pick<TaskList, 'workspaceId' | 'spaceId' | 'name'>;
