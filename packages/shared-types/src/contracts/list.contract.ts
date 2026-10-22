export interface TaskListResponse {
  id: string;
  spaceId: string;
  name: string;
  createdAt: string;
}

export interface CreateTaskListRequest {
  name: string;
}

/** A list's only editable field is its name, so renaming sends the full request. */
export type UpdateTaskListRequest = CreateTaskListRequest;
