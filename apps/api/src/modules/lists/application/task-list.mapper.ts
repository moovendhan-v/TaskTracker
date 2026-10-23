import type { TaskListResponse } from '@taskflow/shared-types';
import type { TaskList } from '../domain/task-list.js';

export const TaskListMapper = {
  toResponse(list: TaskList): TaskListResponse {
    return { id: list.id, spaceId: list.spaceId, name: list.name, createdAt: list.createdAt.toISOString() };
  },
};
