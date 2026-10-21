export interface TaskListResponse {
  id: string;
  spaceId: string;
  name: string;
  createdAt: string;
}

export interface CreateTaskListRequest {
  name: string;
}

export type UpdateTaskListRequest = Partial<CreateTaskListRequest>;
