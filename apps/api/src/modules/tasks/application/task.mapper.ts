import type { TaskResponse } from '@taskflow/shared-types';
import type { Task } from '../domain/task.js';

export const TaskMapper = {
  toResponse(task: Task): TaskResponse {
    return {
      id: task.id,
      listId: task.listId,
      title: task.title,
      description: task.description,
      status: task.status,
      priority: task.priority,
      dueDate: task.dueDate ? task.dueDate.toISOString() : null,
      assigneeId: task.assigneeId,
      position: task.position,
      createdAt: task.createdAt.toISOString(),
      updatedAt: task.updatedAt.toISOString(),
    };
  },
};
