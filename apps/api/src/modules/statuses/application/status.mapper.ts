import type { TaskStatusResponse } from '@taskflow/shared-types';
import type { TaskStatus } from '../domain/task-status.js';

export const StatusMapper = {
  toResponse(status: TaskStatus): TaskStatusResponse {
    return { id: status.id, spaceId: status.spaceId, name: status.name, color: status.color, category: status.category, position: status.position };
  },
};
