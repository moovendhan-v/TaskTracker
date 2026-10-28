import type { TaskResponse, TaskStatusResponse } from '@taskflow/shared-types';
import type { Task } from '../domain/task.js';

/** What a task response needs besides the task itself, loaded once per batch. */
export interface TaskContext {
  statuses: ReadonlyMap<string, TaskStatusResponse>;
  spaceOfList: ReadonlyMap<string, string>;
  subtaskCounts: ReadonlyMap<string, number>;
}

const MISSING_STATUS: Omit<TaskStatusResponse, 'id'> = { spaceId: '', name: 'Unknown', color: '#94a3b8', category: 'unstarted', position: 0 };

export const TaskMapper = {
  toResponse(task: Task, context: TaskContext): TaskResponse {
    return {
      id: task.id,
      number: task.number,
      listId: task.listId,
      spaceId: context.spaceOfList.get(task.listId) ?? '',
      parentId: task.parentId,
      type: task.type,
      title: task.title,
      description: task.description,
      statusId: task.statusId,
      status: context.statuses.get(task.statusId) ?? { id: task.statusId, ...MISSING_STATUS },
      priority: task.priority,
      startDate: task.startDate ? task.startDate.toISOString() : null,
      dueDate: task.dueDate ? task.dueDate.toISOString() : null,
      assigneeId: (task.assigneeIds && task.assigneeIds.length > 0 && task.assigneeIds[0]) ? task.assigneeIds[0] : (task.assigneeId ?? null),
      assigneeIds: (task.assigneeIds && task.assigneeIds.length > 0) ? task.assigneeIds : (task.assigneeId ? [task.assigneeId] : []),
      sprintId: task.sprintId,
      position: task.position,
      estimateMinutes: task.estimateMinutes,
      progress: task.progress,
      subtaskCount: context.subtaskCounts.get(task.id) ?? 0,
      metadata: task.metadata ?? {},
      customFields: task.customFields ?? {},
      completedAt: task.completedAt ? task.completedAt.toISOString() : null,
      createdById: task.createdById,
      createdAt: task.createdAt.toISOString(),
      updatedAt: task.updatedAt.toISOString(),
    };
  },
};
